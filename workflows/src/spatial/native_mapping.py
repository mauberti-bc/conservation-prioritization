"""Map authoritative native raster windows onto bounded planning-grid tiles."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

import numpy as np
import rioxarray  # noqa: F401
import xarray as xr
from affine import Affine
from pyproj import CRS
from rasterio.features import rasterize
from rasterio.transform import array_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds
from shapely.geometry import mapping
from shapely.geometry.base import BaseGeometry

from ..optimization.grid import GridTile
from .resampling import (
    aggregate_nested_values,
    rasterio_resampling,
    validate_resampling_contract,
)


@dataclass(frozen=True)
class NativeLayerDescriptor:
    """Spatial and storage identity for one authoritative native Zarr array."""

    layer_id: str
    group_path: str
    variable: str
    crs: str
    transform: Affine
    height: int
    width: int
    chunks: tuple[int, int] | None
    dtype: str
    nodata: float | int | None
    native_resolution: float


@dataclass(frozen=True)
class PlanningGrid:
    """One AOI-bounded view of an immutable destination planning grid."""

    crs: str
    transform: Affine
    height: int
    width: int
    resolution: int
    full_grid_width: int
    global_row_offset: int
    global_col_offset: int


@dataclass(frozen=True)
class MappedPlanningTile:
    """Values and lineage produced for exactly one destination tile."""

    values: np.ndarray
    valid: np.ndarray
    method: str
    native_resolution: float
    source_window: tuple[int, int, int, int] | None


class NativeLayer:
    """Opened native array paired with its validated spatial descriptor."""

    def __init__(
        self,
        data: xr.DataArray,
        descriptor: NativeLayerDescriptor,
        contract: Mapping[str, Any],
    ) -> None:
        self.data = data
        self.descriptor = descriptor
        self.contract = contract


def build_planning_grid(
    geometries: Sequence[BaseGeometry],
    resolution: int,
    grid_extent: Sequence[float] | None = None,
    crs: str = "EPSG:3005",
) -> PlanningGrid:
    """Construct an AOI window on the destination grid without consulting a layer."""
    if not geometries:
        raise ValueError("At least one planning geometry is required.")
    if resolution <= 0:
        raise ValueError("Planning-unit resolution must be positive.")
    bounds = _geometry_bounds(geometries)
    if grid_extent and len(grid_extent) == 4:
        grid_left, grid_bottom, grid_right, grid_top = (
            float(value) for value in grid_extent
        )
        left = max(
            grid_left,
            grid_left + math.floor((bounds[0] - grid_left) / resolution) * resolution,
        )
        right = min(
            grid_right,
            grid_left + math.ceil((bounds[2] - grid_left) / resolution) * resolution,
        )
        top = min(
            grid_top,
            grid_top - math.floor((grid_top - bounds[3]) / resolution) * resolution,
        )
        bottom = max(
            grid_bottom,
            grid_top - math.ceil((grid_top - bounds[1]) / resolution) * resolution,
        )
        full_grid_width = math.ceil((grid_right - grid_left) / resolution)
        global_row_offset = int(round((grid_top - top) / resolution))
        global_col_offset = int(round((left - grid_left) / resolution))
    else:
        left = math.floor(bounds[0] / resolution) * resolution
        right = math.ceil(bounds[2] / resolution) * resolution
        bottom = math.floor(bounds[1] / resolution) * resolution
        top = math.ceil(bounds[3] / resolution) * resolution
        full_grid_width = max(1, math.ceil((right - left) / resolution))
        global_row_offset = 0
        global_col_offset = 0
    if right <= left or top <= bottom:
        raise ValueError("AOI does not intersect the configured planning-grid extent.")
    width = math.ceil((right - left) / resolution)
    height = math.ceil((top - bottom) / resolution)
    return PlanningGrid(
        crs=crs,
        transform=Affine(resolution, 0.0, left, 0.0, -resolution, top),
        height=height,
        width=width,
        resolution=resolution,
        full_grid_width=full_grid_width,
        global_row_offset=global_row_offset,
        global_col_offset=global_col_offset,
    )


def planning_tile_mask(
    tile: GridTile,
    grid: PlanningGrid,
    geometries: Sequence[BaseGeometry],
) -> np.ndarray:
    """Rasterize destination-cell AOI membership for one planning tile."""
    tile_transform = grid.transform * Affine.translation(tile.col_start, tile.row_start)
    return rasterize(
        [(mapping(geometry), 1) for geometry in geometries],
        out_shape=tile.shape,
        transform=tile_transform,
        fill=0,
        dtype=np.uint8,
    ).astype(bool)


def open_native_layer(
    zarr_store: Any,
    layer_id: str,
    contract: Mapping[str, Any],
) -> NativeLayer:
    """Open one native array directly and derive its descriptor from real metadata."""
    validate_resampling_contract(contract, layer_id)
    if "/" not in layer_id:
        raise ValueError(f"Invalid native layer path: {layer_id}.")
    group_path, variable = layer_id.rsplit("/", 1)
    dataset = xr.open_zarr(zarr_store, group=group_path, consolidated=True)
    if variable not in dataset:
        raise KeyError(
            f"No variable named '{variable}' in native group '{group_path}'."
        )
    data = dataset[variable]
    if data.ndim != 2 or tuple(data.dims) != ("y", "x"):
        raise ValueError(f"Native layer {layer_id} must have y/x dimensions.")
    contract_transform = contract.get("native_transform")
    transform = (
        Affine.from_gdal(*(float(value) for value in contract_transform))
        if isinstance(contract_transform, (list, tuple))
        and len(contract_transform) == 6
        else data.rio.transform()
    )
    discovered_crs = data.rio.crs
    crs_value = contract.get("native_crs") or (
        discovered_crs.to_string() if discovered_crs is not None else None
    )
    if not crs_value:
        raise ValueError(f"Native layer {layer_id} does not declare a CRS.")
    resolution_x = math.hypot(transform.a, transform.d)
    resolution_y = math.hypot(transform.b, transform.e)
    native_resolution = (resolution_x + resolution_y) / 2.0
    declared_resolution = contract.get("native_resolution") or contract.get(
        "evidence_resolution"
    )
    if declared_resolution is not None and not math.isclose(
        float(declared_resolution), native_resolution, rel_tol=0.0, abs_tol=1e-4
    ):
        if contract.get("compatibility_mode") != "legacy_noncanonical":
            raise ValueError(
                f"Layer {layer_id} declares {declared_resolution} m evidence but "
                f"its affine transform measures {native_resolution:g} m."
            )
    chunks = None
    if data.chunks:
        chunks = (int(data.chunks[0][0]), int(data.chunks[1][0]))
    descriptor = NativeLayerDescriptor(
        layer_id=layer_id,
        group_path=group_path,
        variable=variable,
        crs=CRS.from_user_input(crs_value).to_string(),
        transform=transform,
        height=int(data.sizes["y"]),
        width=int(data.sizes["x"]),
        chunks=chunks,
        dtype=str(data.dtype),
        nodata=data.rio.nodata,
        native_resolution=native_resolution,
    )
    return NativeLayer(data, descriptor, contract)


def map_native_layer_to_planning_tile(
    layer: NativeLayer,
    grid: PlanningGrid,
    tile: GridTile,
) -> MappedPlanningTile:
    """Map one bounded native source window into exactly one planning tile."""
    destination_transform = grid.transform * Affine.translation(
        tile.col_start, tile.row_start
    )
    method, factor, source_offsets = _classify_mapping(
        layer.descriptor,
        layer.contract,
        grid.crs,
        destination_transform,
        tile.shape,
    )
    if method in {"direct", "nested_aggregate"}:
        row_start, col_start = source_offsets
        source_height = tile.shape[0] * factor
        source_width = tile.shape[1] * factor
        values = _read_padded_window(
            layer.data,
            row_start,
            col_start,
            source_height,
            source_width,
        )
        if method == "nested_aggregate":
            values = aggregate_nested_values(
                values,
                tile.shape,
                factor,
                str(layer.contract.get("aggregation_method", "")),
            )
        return MappedPlanningTile(
            values=values.astype(np.float32, copy=False),
            valid=np.isfinite(values),
            method=method,
            native_resolution=layer.descriptor.native_resolution,
            source_window=(
                row_start,
                row_start + source_height,
                col_start,
                col_start + source_width,
            ),
        )
    return _map_general(layer, grid.crs, destination_transform, tile.shape, method)


def excludes_nodata_from_planning_units(contract: Mapping[str, Any]) -> bool:
    """Return whether this contract makes missing evidence globally ineligible."""
    semantics = str(contract.get("nodata_semantics", "")).lower()
    return semantics in {
        "excluded",
        "excluded_from_planning_units",
        "planning_unit_excluded",
    }


def _classify_mapping(
    descriptor: NativeLayerDescriptor,
    contract: Mapping[str, Any],
    destination_crs: str,
    destination_transform: Affine,
    destination_shape: tuple[int, int],
) -> tuple[str, int, tuple[int, int]]:
    same_crs = CRS.from_user_input(descriptor.crs) == CRS.from_user_input(
        destination_crs
    )
    source = descriptor.transform
    axis_aligned = all(
        math.isclose(value, 0.0, abs_tol=1e-10)
        for value in (
            source.b,
            source.d,
            destination_transform.b,
            destination_transform.d,
        )
    )
    factor_value = abs(destination_transform.a / source.a) if source.a else 0.0
    factor = max(1, int(round(factor_value)))
    source_col, source_row = (~source) * (
        destination_transform.c,
        destination_transform.f,
    )
    aligned = math.isclose(
        source_col, round(source_col), abs_tol=1e-7
    ) and math.isclose(source_row, round(source_row), abs_tol=1e-7)
    square_scale = math.isclose(
        abs(destination_transform.e / source.e), factor_value, abs_tol=1e-7
    )
    integer_scale = math.isclose(factor_value, factor, abs_tol=1e-7)
    if not same_crs:
        return "bounded_reproject", 1, (0, 0)
    if same_crs and axis_aligned and aligned and square_scale and integer_scale:
        if factor == 1:
            return "direct", 1, (int(round(source_row)), int(round(source_col)))
        if descriptor.native_resolution < abs(destination_transform.a):
            return (
                "nested_aggregate",
                factor,
                (int(round(source_row)), int(round(source_col))),
            )
    if descriptor.native_resolution > abs(destination_transform.a):
        policy = str(contract.get("coarse_to_fine_policy", "prohibit"))
        if policy == "prohibit":
            raise ValueError(
                f"Layer {descriptor.layer_id} has native evidence resolution "
                f"{descriptor.native_resolution:g} m, planning units are "
                f"{abs(destination_transform.a):g} m, and its coarse-to-fine "
                "policy prohibits this mapping."
            )
        if policy not in {"nearest_constant", "overlap_constant", "domain_method"}:
            raise ValueError(
                f"Layer {descriptor.layer_id} has unsupported coarse-to-fine "
                f"policy {policy}."
            )
        if policy == "domain_method":
            raise ValueError(
                f"Layer {descriptor.layer_id} requires a domain mapping method "
                "that is not implemented."
            )
        return f"coarse_to_fine_{policy}", 1, (0, 0)
    return "bounded_reproject", 1, (0, 0)


def _map_general(
    layer: NativeLayer,
    destination_crs: str,
    destination_transform: Affine,
    destination_shape: tuple[int, int],
    method: str,
) -> MappedPlanningTile:
    bounds = array_bounds(
        destination_shape[0], destination_shape[1], destination_transform
    )
    source_bounds = transform_bounds(
        destination_crs,
        layer.descriptor.crs,
        *bounds,
        densify_pts=21,
    )
    resampling = rasterio_resampling(method, layer.contract)
    halo = 0 if resampling.name == "nearest" else 1
    requested = from_bounds(*source_bounds, transform=layer.descriptor.transform)
    row_start = math.floor(requested.row_off) - halo
    col_start = math.floor(requested.col_off) - halo
    row_stop = math.ceil(requested.row_off + requested.height) + halo
    col_stop = math.ceil(requested.col_off + requested.width) + halo
    clipped_row_start = max(0, row_start)
    clipped_col_start = max(0, col_start)
    clipped_row_stop = min(layer.descriptor.height, row_stop)
    clipped_col_stop = min(layer.descriptor.width, col_stop)
    destination = np.full(destination_shape, np.nan, dtype=np.float32)
    if clipped_row_stop <= clipped_row_start or clipped_col_stop <= clipped_col_start:
        return MappedPlanningTile(
            destination,
            np.zeros(destination_shape, dtype=bool),
            method,
            layer.descriptor.native_resolution,
            None,
        )
    source_data = layer.data.isel(
        y=slice(clipped_row_start, clipped_row_stop),
        x=slice(clipped_col_start, clipped_col_stop),
    ).data
    source_values = np.asarray(
        source_data.compute() if hasattr(source_data, "compute") else source_data,
        dtype=np.float32,
    )
    source_transform = layer.descriptor.transform * Affine.translation(
        clipped_col_start, clipped_row_start
    )
    reproject(
        source=source_values,
        destination=destination,
        src_transform=source_transform,
        src_crs=layer.descriptor.crs,
        src_nodata=np.nan,
        dst_transform=destination_transform,
        dst_crs=destination_crs,
        dst_nodata=np.nan,
        resampling=resampling,
    )
    if (
        method == "coarse_to_fine_overlap_constant"
        and str(layer.contract.get("extensive_or_intensive")) == "extensive"
    ):
        source_area = abs(
            layer.descriptor.transform.a * layer.descriptor.transform.e
            - layer.descriptor.transform.b * layer.descriptor.transform.d
        )
        destination_area = abs(
            destination_transform.a * destination_transform.e
            - destination_transform.b * destination_transform.d
        )
        destination *= destination_area / source_area
    return MappedPlanningTile(
        destination,
        np.isfinite(destination),
        method,
        layer.descriptor.native_resolution,
        (
            clipped_row_start,
            clipped_row_stop,
            clipped_col_start,
            clipped_col_stop,
        ),
    )


def _read_padded_window(
    data: xr.DataArray,
    row_start: int,
    col_start: int,
    height: int,
    width: int,
) -> np.ndarray:
    destination = np.full((height, width), np.nan, dtype=np.float32)
    source_row_start = max(0, row_start)
    source_col_start = max(0, col_start)
    source_row_stop = min(int(data.sizes["y"]), row_start + height)
    source_col_stop = min(int(data.sizes["x"]), col_start + width)
    if source_row_stop <= source_row_start or source_col_stop <= source_col_start:
        return destination
    source = data.isel(
        y=slice(source_row_start, source_row_stop),
        x=slice(source_col_start, source_col_stop),
    ).data
    values = np.asarray(
        source.compute() if hasattr(source, "compute") else source,
        dtype=np.float32,
    )
    destination_row = source_row_start - row_start
    destination_col = source_col_start - col_start
    destination[
        destination_row : destination_row + values.shape[0],
        destination_col : destination_col + values.shape[1],
    ] = values
    return destination


def _geometry_bounds(
    geometries: Sequence[BaseGeometry],
) -> tuple[float, float, float, float]:
    return (
        min(geometry.bounds[0] for geometry in geometries),
        min(geometry.bounds[1] for geometry in geometries),
        max(geometry.bounds[2] for geometry in geometries),
        max(geometry.bounds[3] for geometry in geometries),
    )
