import hashlib
import json
import logging
import os
import time
from dataclasses import asdict, replace
from pathlib import Path
from collections import defaultdict
from functools import lru_cache
from typing import Annotated, Any, Dict, Literal, Optional, Sequence, Union

import geopandas as gpd
import numpy as np
import xarray as xr
import pyarrow as pa
import pyarrow.parquet as pq
from affine import Affine
from prefect import task
from pydantic import BaseModel, Field, field_validator, model_validator
from shapely import GeometryCollection, MultiLineString, MultiPolygon
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry

from ..utils.object_store import (
    download_source_object,
    get_source_boundary_key,
    get_source_zarr_store,
)
from ..optimization.compiler import (
    SparseConstraintSpecification,
    compile_spatial_optimization,
)
from ..optimization.neighbor import (
    NEIGHBOR_METHOD,
    NEIGHBOR_METHOD_VERSION,
    NeighborPenaltySpecification,
    count_neighbor_edges,
    encode_packed_mask,
    load_neighbor_structure,
    measure_neighbor_structure,
    packed_mask_checksum,
    resolve_neighbor_normalization,
)
from ..optimization.model import (
    CanonicalObjectiveValues,
    CompilationOutput,
    CompilationReconstruction,
)
from ..optimization.objective import (
    resolve_objective_normalization,
    top_k_attainable_scale,
)
from ..optimization.artifact import write_compiled_artifact
from ..optimization.grid import GridTile, grid_cell_ids, iter_grid_tiles
from ..spatial.native_mapping import (
    NativeLayer,
    PlanningGrid,
    build_planning_grid,
    excludes_nodata_from_planning_units,
    map_native_layer_to_planning_tile,
    open_native_layer,
    planning_tile_mask,
)


def get_boundary_asset_path() -> str:
    """
    Resolve and ensure the BC boundary dataset is available on local disk.
    """
    boundary_key = get_source_boundary_key()
    local_boundary_path = "/data/british_columbia.gdb"

    return download_source_object(
        key=boundary_key,
        local_path=local_boundary_path,
    )


class OptimizationObjective(BaseModel):
    """One normalized additive preference in the maximization objective."""

    layer: str
    direction: Literal["maximize", "minimize"]
    importance: float = Field(default=1, ge=0)


class AggregateConstraint(BaseModel):
    """One bounded sum over selected planning units."""

    type: Literal["aggregate"]
    layer: str
    min: Optional[float] = None
    max: Optional[float] = None

    @model_validator(mode="after")
    def require_bound(self):
        if self.min is None and self.max is None:
            raise ValueError("Aggregate constraints require a minimum or maximum.")
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("Aggregate constraint minimum cannot exceed maximum.")
        return self


class PlanningUnitConstraint(BaseModel):
    """One per-unit bound defining which candidates may be selected."""

    type: Literal["planning_unit"]
    layer: str
    min: Optional[float] = None
    max: Optional[float] = None

    @model_validator(mode="after")
    def require_bound(self):
        if self.min is None and self.max is None:
            raise ValueError("Planning-unit constraints require a minimum or maximum.")
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("Planning-unit constraint minimum cannot exceed maximum.")
        return self


OptimizationConstraint = Annotated[
    Union[AggregateConstraint, PlanningUnitConstraint],
    Field(discriminator="type"),
]


class OptimizationParameters(BaseModel):
    """
    Parameters for conservation optimization.

    Attributes:
        target_area: GeoJSON analysis area from which candidates are constructed
        resolution: Output resolution in meters (must be > 0)
        resampling: How to resample input data ("mode", "min", "max")
        objectives: Normalized preferences determining solution quality
        constraints: Aggregate requirements and planning-unit eligibility bounds
    """

    target_area: Sequence[BaseGeometry]
    resolution: int = Field(..., gt=0)
    resampling: Literal["mode", "min", "max"]
    objectives: list[OptimizationObjective] = Field(min_length=1)
    constraints: list[OptimizationConstraint] = Field(default_factory=list)
    layer_contracts: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    grid_extent: Optional[Sequence[float]] = None
    neighbor_penalty: Optional[NeighborPenaltySpecification] = None
    decision_domain: Literal["continuous", "discrete"] = "discrete"
    preserve_primary_domain: bool = False
    allocation_target_row: bool = False

    class Config:
        arbitrary_types_allowed = True

    @field_validator("target_area", mode="before")
    def convert_geojson_to_geometry(cls, v):
        if not isinstance(v, dict):
            raise TypeError("target_area must be a GeoJSON object")
        if v.get("type") == "FeatureCollection":
            values = [item.get("geometry") for item in v.get("features", [])]
        elif v.get("type") == "Feature":
            values = [v.get("geometry")]
        else:
            values = [v]
        geometries = [shape(value) for value in values if value is not None]
        if not geometries:
            raise ValueError("target_area must contain at least one geometry")
        return geometries

    @model_validator(mode="after")
    def validate_layers(self):
        objective_layers = [objective.layer for objective in self.objectives]
        if len(set(objective_layers)) != len(objective_layers):
            raise ValueError("Each layer may appear at most once in objectives.")
        referenced = {
            *(objective.layer for objective in self.objectives),
            *(constraint.layer for constraint in self.constraints),
        }
        missing = referenced - self.layer_contracts.keys()
        if missing:
            raise ValueError(f"Missing layer contracts: {', '.join(sorted(missing))}")
        return self


def load_british_columbia_boundary(path: str) -> Sequence[BaseGeometry]:
    """
    Load and return a GeoSeries of geometries from the first layer of a GDB.
    This may include multiple Polygon or MultiPolygon features.
    """
    layers = gpd.list_layers(path)
    first_layer_name = str(layers.loc[0, "name"])
    gdf = gpd.read_file(path, layer=first_layer_name)

    return [gdf.geometry.union_all(method="coverage")]


def compile_prepared_model(
    conditions: OptimizationParameters,
    sparse_artifact_dir: Optional[str] = None,
) -> CompilationOutput:
    """Compile normalized objectives and aggregate rows into a sparse model."""
    logger = logging.getLogger(__name__)
    if not sparse_artifact_dir:
        raise ValueError(
            "sparse_artifact_dir is required for bounded spatial compilation"
        )

    artifact_dir = Path(sparse_artifact_dir)
    manifest_path = artifact_dir / "preparation-manifest.json"
    counts_path = artifact_dir / "sparse-counts.json"
    if not manifest_path.exists() or not counts_path.exists():
        raise ValueError("Sparse preparation is missing committed sizing metadata.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    counts = json.loads(counts_path.read_text(encoding="utf-8"))
    planning_unit_count = int(manifest["planning_unit_count"])
    compiled_dir = artifact_dir / "compiled-model"
    compiled_dir.mkdir(parents=True, exist_ok=True)
    catalog_path = artifact_dir / "feature-catalog.json"
    if not catalog_path.exists():
        raise ValueError("Sparse preparation is missing its feature catalog.")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))["features"]
    feature_names = {int(index): name for name, index in catalog.items()}
    feature_counts = {
        int(index): int(count)
        for index, count in counts["feature_nonzero_counts"].items()
    }
    aggregate_by_layer = {
        layer_name: [
            constraint
            for constraint in conditions.constraints
            if isinstance(constraint, AggregateConstraint)
            and constraint.layer == layer_name
        ]
        for layer_name in catalog
    }
    constrained_features = {
        int(catalog[layer_name])
        for layer_name, constraints in aggregate_by_layer.items()
        if constraints
    }
    objective_features = {
        int(catalog[objective.layer]) for objective in conditions.objectives
    }
    feature_indices = {
        index: (
            np.lib.format.open_memmap(
                compiled_dir / f"feature-{index}-indices.npy",
                mode="w+",
                dtype=np.int32,
                shape=(count,),
            )
            if count > 0
            else np.empty(0, dtype=np.int32)
        )
        for index, count in feature_counts.items()
        if index in constrained_features
    }
    feature_values = {
        index: (
            np.lib.format.open_memmap(
                compiled_dir / f"feature-{index}-values.npy",
                mode="w+",
                dtype=np.float64,
                shape=(count,),
            )
            if count > 0
            else np.empty(0, dtype=np.float64)
        )
        for index, count in feature_counts.items()
        if index in constrained_features
    }
    feature_offsets = {index: 0 for index in constrained_features}
    objective_indices = {
        index: (
            np.lib.format.open_memmap(
                compiled_dir / f"objective-{index}-indices-staging.npy",
                mode="w+",
                dtype=np.int32,
                shape=(count,),
            )
            if count > 0
            else np.empty(0, dtype=np.int32)
        )
        for index, count in feature_counts.items()
        if index in objective_features
    }
    objective_values = {
        index: (
            np.lib.format.open_memmap(
                compiled_dir / f"objective-{index}-values-staging.npy",
                mode="w+",
                dtype=np.float64,
                shape=(count,),
            )
            if count > 0
            else np.empty(0, dtype=np.float64)
        )
        for index, count in feature_counts.items()
        if index in objective_features
    }
    objective_offsets = {index: 0 for index in objective_features}
    solver_objective = np.lib.format.open_memmap(
        compiled_dir / "solver-objective-staging.npy",
        mode="w+",
        dtype=np.float64,
        shape=(planning_unit_count,),
    )
    solver_objective.fill(0)
    objectives_by_layer = {
        objective.layer: objective for objective in conditions.objectives
    }
    normalization = manifest["objective_normalization"]
    for expected_order, segment in enumerate(manifest["compilation_segments"]):
        if int(segment["partition_order"]) != expected_order:
            raise ValueError("Compilation segment order is not contiguous.")
        for path_key, checksum_key in (
            ("planning_unit_path", "planning_unit_checksum"),
            (
                "constraint_coefficients_path",
                "constraint_coefficients_checksum",
            ),
        ):
            relative_path = segment.get(path_key)
            if relative_path is None:
                continue
            if _file_checksum(artifact_dir / str(relative_path)) != str(
                segment[checksum_key]
            ):
                raise ValueError(f"Compilation segment checksum mismatch: {path_key}.")
    for path in sorted((artifact_dir / "feature-representation").glob("*.parquet")):
        parquet = pq.ParquetFile(path)
        for batch in parquet.iter_batches(
            batch_size=65536,
            columns=["feature_index", "variable_index", "amount"],
        ):
            identifiers = (
                batch.column("feature_index").to_numpy().astype(np.int32, copy=False)
            )
            batch_indices = batch.column("variable_index").to_numpy()
            batch_values = batch.column("amount").to_numpy()
            for feature_index_value in np.unique(identifiers):
                feature_index = int(feature_index_value)
                selected = identifiers == feature_index
                selected_indices = batch_indices[selected]
                selected_values = batch_values[selected]
                layer_name = feature_names[feature_index]
                if layer_name in objectives_by_layer:
                    np.add.at(
                        solver_objective,
                        selected_indices,
                        float(normalization[layer_name]["resolved_coefficient"])
                        * selected_values,
                    )
                    start = objective_offsets[feature_index]
                    stop = start + len(selected_indices)
                    objective_indices[feature_index][start:stop] = selected_indices
                    objective_values[feature_index][start:stop] = selected_values
                    objective_offsets[feature_index] = stop
                if feature_index in constrained_features:
                    start = feature_offsets[feature_index]
                    stop = start + len(selected_indices)
                    feature_indices[feature_index][start:stop] = selected_indices
                    feature_values[feature_index][start:stop] = selected_values
                    feature_offsets[feature_index] = stop
    features: list[SparseConstraintSpecification] = []
    for layer_name in catalog:
        feature_index = catalog[layer_name]
        if feature_names.get(int(feature_index)) != layer_name:
            raise ValueError("Feature catalog is internally inconsistent.")
        if int(feature_index) not in constrained_features:
            continue
        if feature_offsets[int(feature_index)] != feature_counts[int(feature_index)]:
            raise ValueError(f"Feature count differs from metadata: {layer_name}")
        features.append(
            SparseConstraintSpecification(
                layer_id=layer_name,
                indices=feature_indices[int(feature_index)],
                values=feature_values[int(feature_index)],
                constraints=[
                    (constraint.min, constraint.max)
                    for constraint in aggregate_by_layer[layer_name]
                ],
            )
        )
    compiled = compile_spatial_optimization(
        planning_units=None,
        planning_unit_count=planning_unit_count,
        constraints=features,
        neighbor_penalty=conditions.neighbor_penalty,
        neighbor_structure=(
            load_neighbor_structure(
                json.loads(
                    (artifact_dir / "planning-structure.json").read_text(
                        encoding="utf-8"
                    )
                )
            )
            if conditions.neighbor_penalty is not None
            else None
        ),
        array_directory=compiled_dir,
        fused_objective=solver_objective,
        canonical_objectives=tuple(
            CanonicalObjectiveValues(
                layer=objective.layer,
                indices=objective_indices[int(catalog[objective.layer])],
                values=objective_values[int(catalog[objective.layer])],
            )
            for objective in conditions.objectives
        ),
        decision_domain=conditions.decision_domain,
        preserve_primary_domain=conditions.preserve_primary_domain,
        allocation_target_row=conditions.allocation_target_row,
    )
    for objective in conditions.objectives:
        feature_index = int(catalog[objective.layer])
        if objective_offsets[feature_index] != feature_counts[feature_index]:
            raise ValueError(
                f"Objective feature count differs from metadata: {objective.layer}"
            )
    _discard_intermediate_sparse_vectors(
        feature_indices,
        feature_values,
    )
    logger.info(
        "Compiled sparse solver-neutral model with %s variables and %s constraints",
        compiled.model.variable_count,
        compiled.model.constraint_count,
    )
    return compiled




def _discard_intermediate_sparse_vectors(
    feature_indices: Dict[int, np.ndarray],
    feature_values: Dict[int, np.ndarray],
    additional_arrays: Sequence[np.ndarray] = (),
) -> None:
    """Release disposable O(K) staging arrays after final CSR construction."""
    arrays = [
        *feature_indices.values(),
        *feature_values.values(),
        *additional_arrays,
    ]
    paths: list[Path] = []
    for values in arrays:
        if isinstance(values, np.memmap):
            paths.append(Path(values.filename))
            values.flush()
            values._mmap.close()
    for path in paths:
        path.unlink(missing_ok=True)


def _resolve_analysis_geometry(
    conditions: OptimizationParameters,
) -> Sequence[BaseGeometry]:
    """Resolve the run AOI in the authoritative planning-grid CRS."""
    geometry_frame = gpd.GeoDataFrame(
        geometry=conditions.target_area, crs="EPSG:4326"
    ).to_crs("EPSG:3005")
    unified_geometry = geometry_frame.geometry.union_all()
    if isinstance(
        unified_geometry,
        (GeometryCollection, MultiPolygon, MultiLineString),
    ):
        return list(unified_geometry.geoms)
    return [unified_geometry]


def _open_native_layers(
    source_uri: str,
    conditions: OptimizationParameters,
) -> Dict[str, NativeLayer]:
    """Open selected authoritative arrays without probing derived resolution paths."""
    return _open_native_layer_subset(source_uri, conditions.layer_contracts)


def _open_native_layer_subset(
    source_uri: str,
    contracts: Dict[str, Dict[str, Any]],
) -> Dict[str, NativeLayer]:
    """Open one deduplicated subset of authoritative native layer identities."""
    return _open_native_layers_cached(
        source_uri,
        json.dumps(contracts, sort_keys=True, separators=(",", ":")),
    )


@lru_cache(maxsize=8)
def _open_native_layers_cached(
    source_uri: str,
    contracts_json: str,
) -> Dict[str, NativeLayer]:
    """Reuse consolidated Zarr metadata and lazy arrays within each Dask worker."""
    store = get_source_zarr_store(source_uri)
    contracts = json.loads(contracts_json)
    return {
        layer_name: open_native_layer(
            store,
            layer_name,
            contract,
        )
        for layer_name, contract in contracts.items()
    }


def _map_native_tile_dataset(
    native_layers: Dict[str, NativeLayer],
    planning_grid: PlanningGrid,
    tile: Any,
) -> Dict[str, xr.Dataset]:
    """Map every selected native layer into one destination-owned tile dataset."""
    grouped: Dict[str, Dict[str, xr.DataArray]] = defaultdict(dict)
    tile_transform = planning_grid.transform * Affine.translation(
        tile.col_start, tile.row_start
    )
    x_coordinates = (
        tile_transform.c + (np.arange(tile.shape[1]) + 0.5) * tile_transform.a
    )
    y_coordinates = (
        tile_transform.f + (np.arange(tile.shape[0]) + 0.5) * tile_transform.e
    )
    for layer_name, native_layer in native_layers.items():
        mapped = map_native_layer_to_planning_tile(
            native_layer,
            planning_grid,
            tile,
        )
        group_path, variable = layer_name.rsplit("/", 1)
        array = xr.DataArray(
            mapped.values,
            dims=("y", "x"),
            coords={"y": y_coordinates, "x": x_coordinates},
            name=variable,
            attrs={
                "mapping_method": mapped.method,
                "native_resolution": mapped.native_resolution,
            },
        )
        grouped[group_path][variable] = array.rio.write_crs(
            planning_grid.crs
        ).rio.write_transform(tile_transform)
    return {
        group_path: xr.Dataset(variables)
        for group_path, variables in grouped.items()
    }


def _planning_tile_validity(
    tile: Any,
    planning_grid: PlanningGrid,
    geometries: Sequence[BaseGeometry],
    mapped: Dict[str, xr.Dataset],
    conditions: OptimizationParameters,
) -> np.ndarray:
    """Apply the AOI, evidence policy, and per-planning-unit constraints."""
    mask = planning_tile_mask(tile, planning_grid, geometries)
    for layer_name, contract in conditions.layer_contracts.items():
        if not excludes_nodata_from_planning_units(
            contract
        ):
            continue
        group_path, variable = layer_name.rsplit("/", 1)
        mask &= np.isfinite(np.asarray(mapped[group_path][variable].values))
    for constraint in conditions.constraints:
        if not isinstance(constraint, PlanningUnitConstraint):
            continue
        group_path, variable = constraint.layer.rsplit("/", 1)
        values = np.asarray(mapped[group_path][variable].values, dtype=np.float64)
        mask &= np.isfinite(values)
        if constraint.min is not None:
            mask &= values >= constraint.min
        if constraint.max is not None:
            mask &= values <= constraint.max
    return mask


def _eligibility_layers(
    conditions: OptimizationParameters,
) -> Dict[str, Dict[str, Any]]:
    """Return only layers whose nodata contracts affect planning-unit eligibility."""
    return {
        layer_name: contract
        for layer_name, contract in conditions.layer_contracts.items()
        if excludes_nodata_from_planning_units(contract)
        or any(
            isinstance(constraint, PlanningUnitConstraint)
            and constraint.layer == layer_name
            for constraint in conditions.constraints
        )
    }


def _write_compact_json(path: Path, value: Dict[str, Any]) -> str:
    """Write one deterministic metadata record and return its path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    return str(path)


def _file_checksum(path: Path) -> str:
    """Return a bounded SHA-256 checksum for one numeric compiler segment."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _grid_tile_from_record(record: Dict[str, Any]) -> GridTile:
    """Restore the bounded grid tile fields from an inventory record."""
    return GridTile(
        tile_id=str(record["tile_id"]),
        row_start=int(record["row_start"]),
        row_stop=int(record["row_stop"]),
        col_start=int(record["col_start"]),
        col_stop=int(record["col_stop"]),
    )


@lru_cache(maxsize=16)
def _load_planning_grid_context(
    context_path: str,
) -> tuple[PlanningGrid, list[BaseGeometry], int]:
    """Load the small immutable planning-grid context shared by tile tasks."""
    context = json.loads(Path(context_path).read_text(encoding="utf-8"))
    grid = PlanningGrid(
        crs=str(context["crs"]),
        transform=Affine.from_gdal(*(float(value) for value in context["transform"])),
        height=int(context["height"]),
        width=int(context["width"]),
        resolution=int(context["resolution"]),
        full_grid_width=int(context["full_grid_width"]),
        global_row_offset=int(context["global_row_offset"]),
        global_col_offset=int(context["global_col_offset"]),
    )
    geometries = [shape(value) for value in context["geometries"]]
    return grid, geometries, int(context["tile_size"])


@task
def initialize_planning_grid(
    conditions: OptimizationParameters,
    output_path: str,
    tile_size: Optional[int] = None,
) -> str:
    """Persist the AOI-bounded destination grid used by independent tile tasks."""
    geometries = _resolve_analysis_geometry(conditions)
    grid = build_planning_grid(
        geometries,
        conditions.resolution,
        conditions.grid_extent,
    )
    resolved_tile_size = tile_size or int(os.getenv("SPATIAL_TILE_SIZE", "1024"))
    return _write_compact_json(
        Path(output_path),
        {
            "schema_version": 1,
            "crs": grid.crs,
            "transform": list(grid.transform.to_gdal()),
            "height": grid.height,
            "width": grid.width,
            "resolution": grid.resolution,
            "full_grid_width": grid.full_grid_width,
            "global_row_offset": grid.global_row_offset,
            "global_col_offset": grid.global_col_offset,
            "tile_size": resolved_tile_size,
            "geometries": [mapping(geometry) for geometry in geometries],
        },
    )


@task(retries=2, retry_delay_seconds=2)
def count_planning_tile(
    conditions: OptimizationParameters,
    source_uri: str,
    grid_context_path: str,
    tile_record: Dict[str, Any],
    output_directory: str,
) -> str:
    """Count eligible cells in one bounded tile and persist retry-safe metadata."""
    planning_grid, geometries, _ = _load_planning_grid_context(grid_context_path)
    tile = _grid_tile_from_record(tile_record)
    eligibility_layers = _eligibility_layers(conditions)
    opened_layers = (
        _open_native_layer_subset(source_uri, eligibility_layers)
        if eligibility_layers
        else {}
    )
    predicate_telemetry: list[dict[str, object]] = []
    started = time.perf_counter()
    mask = planning_tile_mask(tile, planning_grid, geometries)
    predicate_telemetry.append(
        {
            "predicate_id": "aoi_membership",
            "input_count": int(mask.size),
            "output_count": int(np.count_nonzero(mask)),
            "duration_seconds": time.perf_counter() - started,
            "bytes_read": 0,
            "cache_used": False,
        }
    )
    for layer_name in eligibility_layers:
        input_count = int(np.count_nonzero(mask))
        started = time.perf_counter()
        mapped_layer = map_native_layer_to_planning_tile(
            opened_layers[layer_name], planning_grid, tile
        )
        mapped_values = np.asarray(mapped_layer.values)
        contract = conditions.layer_contracts[layer_name]
        if excludes_nodata_from_planning_units(contract):
            mask &= np.isfinite(mapped_values)
        for constraint in conditions.constraints:
            if (
                not isinstance(constraint, PlanningUnitConstraint)
                or constraint.layer != layer_name
            ):
                continue
            mask &= np.isfinite(mapped_values)
            if constraint.min is not None:
                mask &= mapped_values >= constraint.min
            if constraint.max is not None:
                mask &= mapped_values <= constraint.max
        predicate_telemetry.append(
            {
                "predicate_id": f"required_evidence:{layer_name}",
                "input_count": input_count,
                "output_count": int(np.count_nonzero(mask)),
                "duration_seconds": time.perf_counter() - started,
                "bytes_read": int(mapped_values.nbytes),
                "cache_used": False,
            }
        )
    count = int(np.count_nonzero(mask))
    return _write_compact_json(
        Path(output_directory) / f"tile-{tile.tile_id}.json",
        {
            **tile.to_dict(),
            "valid_planning_unit_count": count,
            "eligibility_mask": encode_packed_mask(mask),
            "packed_mask_bit_order": "little",
            "valid_fraction": count / mask.size,
            "predicate_telemetry": predicate_telemetry,
            "checksum": packed_mask_checksum(mask),
        },
    )


@task
def finalize_planning_inventory(
    task_id: str,
    grid_context_path: str,
    tile_count_directory: str,
    output_path: str,
    include_neighbors: bool = False,
) -> str:
    """Assign deterministic prefix offsets and commit the exact tile inventory."""
    planning_grid, _, tile_size = _load_planning_grid_context(grid_context_path)
    records = [
        json.loads(path.read_text(encoding="utf-8"))
        for path in Path(tile_count_directory).glob("tile-*.json")
    ]
    records.sort(key=lambda record: (record["row_start"], record["col_start"]))
    expected_tiles = list(
        iter_grid_tiles(planning_grid.height, planning_grid.width, tile_size)
    )
    if [record["tile_id"] for record in records] != [
        tile.tile_id for tile in expected_tiles
    ]:
        raise RuntimeError("Tile count records do not exactly cover the planning grid.")
    offset = 0
    for record in records:
        record["variable_index_offset"] = offset
        offset += int(record["valid_planning_unit_count"])
    inventory = {
        "schema_version": 2,
        "task_id": task_id,
        "grid_family_id": "bc_albers_30m_v1",
        "planning_unit_resolution": planning_grid.resolution,
        "aoi_inclusion_rule": "cell_center_v1",
        "height": planning_grid.height,
        "width": planning_grid.width,
        "transform": list(planning_grid.transform.to_gdal()),
        "crs": planning_grid.crs,
        "tile_size": tile_size,
        "planning_unit_count": offset,
        "full_grid_width": planning_grid.full_grid_width,
        "global_row_offset": planning_grid.global_row_offset,
        "global_col_offset": planning_grid.global_col_offset,
        "tiles": records,
    }
    if include_neighbors:
        inventory["neighbor_method"] = NEIGHBOR_METHOD
        inventory["neighbor_method_version"] = NEIGHBOR_METHOD_VERSION
        inventory["raw_neighbor_edge_count"] = count_neighbor_edges(
            load_neighbor_structure(inventory)
        )
    return _write_compact_json(Path(output_path), inventory)


@task(retries=2, retry_delay_seconds=2)
def prepare_planning_tile(
    conditions: OptimizationParameters,
    source_uri: str,
    grid_context_path: str,
    tile_record: Dict[str, Any],
    preparation_output_dir: str,
) -> str:
    """Map and write sparse numeric records for one independently retryable tile."""
    planning_grid, geometries, _ = _load_planning_grid_context(grid_context_path)
    tile = _grid_tile_from_record(tile_record)
    native_layers = _open_native_layers(source_uri, conditions)
    mapped = _map_native_tile_dataset(native_layers, planning_grid, tile)
    mask = _planning_tile_validity(
        tile,
        planning_grid,
        geometries,
        mapped,
        conditions,
    )
    local_rows, local_cols = np.where(mask)
    rows = local_rows + tile.row_start
    cols = local_cols + tile.col_start
    expected_count = int(tile_record["valid_planning_unit_count"])
    if len(rows) != expected_count:
        raise RuntimeError(
            f"Prepared tile {tile.tile_id} differs from its committed count."
        )
    checksum = packed_mask_checksum(mask)
    if checksum != str(tile_record["checksum"]):
        raise RuntimeError(
            f"Prepared tile {tile.tile_id} validity differs from its inventory."
        )
    offset = int(tile_record["variable_index_offset"])
    variable_indices = np.arange(offset, offset + expected_count, dtype=np.int64)
    stable_rows = rows.astype(np.int64) + planning_grid.global_row_offset
    stable_cols = cols.astype(np.int64) + planning_grid.global_col_offset
    cell_ids = grid_cell_ids(
        stable_rows,
        stable_cols,
        planning_grid.full_grid_width,
    )
    root = Path(preparation_output_dir)
    planning_dir = root / "planning-units"
    feature_dir = root / "feature-representation"
    planning_dir.mkdir(parents=True, exist_ok=True)
    feature_dir.mkdir(parents=True, exist_ok=True)
    planning = pa.table(
        {
            "variable_index": variable_indices,
            "grid_cell_id": pa.array(cell_ids, type=pa.uint64()),
            "row": rows.astype(np.int32),
            "col": cols.astype(np.int32),
        }
    )
    planning_path = planning_dir / f"tile-{tile.tile_id}.parquet"
    pq.write_table(
        planning,
        planning_path,
        compression="zstd",
    )

    feature_catalog = {
        layer_name: index
        for index, layer_name in enumerate(
            layer_name for layer_name in conditions.layer_contracts
        )
    }
    feature_counts = {str(index): 0 for index in feature_catalog.values()}
    objective_positive_sums = {
        objective.layer: 0.0 for objective in conditions.objectives
    }
    feature_writer: pq.ParquetWriter | None = None
    try:
        for layer_name in conditions.layer_contracts:
            group_path, variable = layer_name.rsplit("/", 1)
            values = np.asarray(mapped[group_path][variable].values)
            planning_values = values[local_rows, local_cols]
            if layer_name in objective_positive_sums:
                objective_positive_sums[layer_name] = top_k_attainable_scale(
                    planning_values,
                    len(planning_values),
                )
            meaningful_positions = np.isfinite(planning_values) & (
                planning_values != 0
            )
            selected_indices = variable_indices[meaningful_positions]
            selected_values = planning_values[meaningful_positions]
            is_used = layer_name in objective_positive_sums or any(
                isinstance(constraint, AggregateConstraint)
                and constraint.layer == layer_name
                for constraint in conditions.constraints
            )
            if not is_used:
                continue
            feature_index = feature_catalog[layer_name]
            feature_table = pa.table(
                {
                    "feature_index": np.full(
                        len(selected_indices), feature_index, dtype=np.int32
                    ),
                    "variable_index": selected_indices,
                    "amount": selected_values.astype(np.float64),
                }
            )
            if feature_writer is None:
                feature_writer = pq.ParquetWriter(
                    feature_dir / f"tile-{tile.tile_id}.parquet",
                    feature_table.schema,
                    compression="zstd",
                )
            feature_writer.write_table(feature_table)
            feature_counts[str(feature_index)] += len(feature_table)
    finally:
        if feature_writer is not None:
            feature_writer.close()
    feature_path = feature_dir / f"tile-{tile.tile_id}.parquet"
    return _write_compact_json(
        root / "tile-metadata" / f"tile-{tile.tile_id}.json",
        {
            "schema_version": 6,
            "segment_kind": "ordered_numeric_compilation",
            "candidate_order": "local_row_major",
            "tile_id": tile.tile_id,
            "variable_index_offset": offset,
            "planning_unit_count": expected_count,
            "fixed0_mask": encode_packed_mask(np.zeros(mask.shape, dtype=bool)),
            "fixed1_mask": encode_packed_mask(np.zeros(mask.shape, dtype=bool)),
            "fixed0_count": 0,
            "fixed1_count": 0,
            "feature_nonzero_counts": feature_counts,
            "objective_positive_sums": objective_positive_sums,
            "planning_unit_path": str(planning_path.relative_to(root)),
            "planning_unit_checksum": _file_checksum(planning_path),
            "constraint_coefficients_path": (
                str(feature_path.relative_to(root)) if feature_path.exists() else None
            ),
            "constraint_coefficients_checksum": (
                _file_checksum(feature_path) if feature_path.exists() else None
            ),
        },
    )


@task
def finalize_spatial_preparation(
    task_id: str,
    conditions: OptimizationParameters,
    grid_context_path: str,
    preparation_output_dir: str,
    inventory_path: str,
) -> str:
    """Validate all sparse tile parts and commit aggregate preparation metadata."""
    planning_grid, _, tile_size = _load_planning_grid_context(grid_context_path)
    inventory = json.loads(Path(inventory_path).read_text(encoding="utf-8"))
    root = Path(preparation_output_dir)
    metadata_by_id = {
        value["tile_id"]: value
        for value in (
            json.loads(path.read_text(encoding="utf-8"))
            for path in (root / "tile-metadata").glob("tile-*.json")
        )
    }
    expected_ids = [record["tile_id"] for record in inventory["tiles"]]
    if sorted(metadata_by_id) != sorted(expected_ids):
        raise RuntimeError("Prepared tile metadata does not match the inventory.")
    feature_catalog = {
        layer_name: index
        for index, layer_name in enumerate(
            layer_name for layer_name in conditions.layer_contracts
        )
    }
    feature_counts = {str(index): 0 for index in feature_catalog.values()}
    planning_unit_count = 0
    objective_positive_sums = {
        objective.layer: 0.0 for objective in conditions.objectives
    }
    for tile_id in expected_ids:
        metadata = metadata_by_id[tile_id]
        planning_unit_count += int(metadata["planning_unit_count"])
        for layer_name, value in metadata["objective_positive_sums"].items():
            objective_positive_sums[layer_name] += float(value)
        for feature_index, count in metadata["feature_nonzero_counts"].items():
            feature_counts[feature_index] += int(count)
    if planning_unit_count != int(inventory["planning_unit_count"]):
        raise RuntimeError(
            "Preparation planning-unit count differs from the committed inventory."
        )
    objective_normalization: Dict[str, Dict[str, Any]] = {}
    for objective in conditions.objectives:
        resolved = resolve_objective_normalization(
            layer=objective.layer,
            direction=objective.direction,
            importance=objective.importance,
            attainable_scale=objective_positive_sums[objective.layer],
            selection_count=planning_unit_count,
        )
        objective_normalization[objective.layer] = resolved.to_dict()
    neighbor_metadata: Dict[str, Any] = {}
    if conditions.neighbor_penalty is not None:
        structure_tiles = []
        for inventory_tile in inventory["tiles"]:
            metadata = metadata_by_id[str(inventory_tile["tile_id"])]
            structure_tiles.append(
                {
                    **inventory_tile,
                    "fixed0_mask": metadata["fixed0_mask"],
                    "fixed1_mask": metadata["fixed1_mask"],
                    "fixed0_count": int(metadata["fixed0_count"]),
                    "fixed1_count": int(metadata["fixed1_count"]),
                }
            )
        planning_structure = {
            "schema_version": 1,
            "neighbor_method": NEIGHBOR_METHOD,
            "neighbor_method_version": NEIGHBOR_METHOD_VERSION,
            "domain_simplification_version": 1,
            "height": planning_grid.height,
            "width": planning_grid.width,
            "tile_size": tile_size,
            "planning_unit_count": planning_unit_count,
            "raw_neighbor_edge_count": int(inventory["raw_neighbor_edge_count"]),
            "tiles": structure_tiles,
        }
        _write_compact_json(root / "planning-structure.json", planning_structure)
        structure_counts = measure_neighbor_structure(
            load_neighbor_structure(planning_structure)
        )
        attainable_neighbor_edge_count = (
            structure_counts.constant_selected
            + structure_counts.fixed1_unary
            + structure_counts.pairwise
        )
        neighbor_normalization = resolve_neighbor_normalization(
            conditions.neighbor_penalty,
            attainable_neighbor_edge_count,
        )
        neighbor_metadata = {
            "raw_neighbor_edge_count": int(inventory["raw_neighbor_edge_count"]),
            "attainable_neighbor_edge_count": attainable_neighbor_edge_count,
            "planning_structure": "planning-structure.json",
            "neighbor_normalization": neighbor_normalization.to_dict(),
        }
    _write_compact_json(
        root / "feature-catalog.json",
        {"schema_version": 1, "features": feature_catalog},
    )
    _write_compact_json(
        root / "sparse-counts.json",
        {
            "schema_version": 1,
            "planning_unit_count": planning_unit_count,
            "feature_nonzero_counts": feature_counts,
            "feature_nonzero_count": sum(feature_counts.values()),
            "fixed0_count": sum(
                int(value["fixed0_count"]) for value in metadata_by_id.values()
            ),
            "fixed1_count": sum(
                int(value["fixed1_count"]) for value in metadata_by_id.values()
            ),
            **neighbor_metadata,
        },
    )
    return _write_compact_json(
        root / "preparation-manifest.json",
        {
            "schema_version": 6,
            "task_id": task_id,
            "height": planning_grid.height,
            "width": planning_grid.width,
            "transform": list(planning_grid.transform.to_gdal()),
            "crs": planning_grid.crs,
            "resolution": planning_grid.resolution,
            "tile_size": tile_size,
            "planning_unit_count": planning_unit_count,
            "feature_nonzero_count": sum(feature_counts.values()),
            "feature_nonzero_counts": feature_counts,
            "objective_normalization": objective_normalization,
            "fixed0_count": sum(
                int(value["fixed0_count"]) for value in metadata_by_id.values()
            ),
            "fixed1_count": sum(
                int(value["fixed1_count"]) for value in metadata_by_id.values()
            ),
            "compilation_segments": [
                {
                    "partition_order": partition_order,
                    "segment_kind": metadata_by_id[tile_id]["segment_kind"],
                    "candidate_order": metadata_by_id[tile_id]["candidate_order"],
                    "tile_id": tile_id,
                    "variable_index_offset": int(
                        metadata_by_id[tile_id]["variable_index_offset"]
                    ),
                    "planning_unit_count": int(
                        metadata_by_id[tile_id]["planning_unit_count"]
                    ),
                    "planning_unit_path": metadata_by_id[tile_id][
                        "planning_unit_path"
                    ],
                    "planning_unit_checksum": metadata_by_id[tile_id][
                        "planning_unit_checksum"
                    ],
                    "constraint_coefficients_path": metadata_by_id[tile_id][
                        "constraint_coefficients_path"
                    ],
                    "constraint_coefficients_checksum": metadata_by_id[tile_id][
                        "constraint_coefficients_checksum"
                    ],
                }
                for partition_order, tile_id in enumerate(expected_ids)
            ],
            **neighbor_metadata,
            "full_grid_width": planning_grid.full_grid_width,
            "global_row_offset": planning_grid.global_row_offset,
            "global_col_offset": planning_grid.global_col_offset,
        },
    )




@task
def compile_prepared_artifact(
    conditions: OptimizationParameters,
    preparation_output_dir: str,
    problem_definition_hash: Optional[str] = None,
) -> CompilationOutput:
    """Compile and commit the canonical numerical artifact on the solver process."""
    compiled = compile_prepared_model(
        conditions=conditions,
        sparse_artifact_dir=preparation_output_dir,
    )
    reconstruction = compiled.reconstruction
    model = compiled.model
    reduction_manifest = reconstruction.reduction.to_dict()
    _write_compact_json(
        Path(preparation_output_dir) / "reduction-manifest.json",
        reduction_manifest,
    )
    preparation_manifest_path = (
        Path(preparation_output_dir) / "preparation-manifest.json"
    )
    preparation_manifest = json.loads(
        preparation_manifest_path.read_text(encoding="utf-8")
    )
    preparation_manifest["reduction"] = reduction_manifest
    _write_compact_json(preparation_manifest_path, preparation_manifest)
    resolved_problem_hash = (
        problem_definition_hash
        or hashlib.sha256(
            json.dumps(
                {
                    "target_area": [mapping(value) for value in conditions.target_area],
                    "objectives": [
                        value.model_dump(mode="json")
                        for value in conditions.objectives
                    ],
                    "constraints": [
                        value.model_dump(mode="json")
                        for value in conditions.constraints
                    ],
                    "neighbor_penalty": (
                        asdict(conditions.neighbor_penalty)
                        if conditions.neighbor_penalty is not None
                        else None
                    ),
                    "resolution": conditions.resolution,
                    "resampling": conditions.resampling,
                    "decision_domain": conditions.decision_domain,
                    "preserve_primary_domain": conditions.preserve_primary_domain,
                    "allocation_target_row": conditions.allocation_target_row,
                    "layer_contracts": conditions.layer_contracts,
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
    )
    (
        candidate_ids,
        candidate_sources,
        fixed_ids,
        fixed_sources,
        fixed_values,
    ) = _compiled_reconstruction_arrays(
        Path(preparation_output_dir), reconstruction
    )
    additional_arrays: Dict[str, np.ndarray] = {}
    objective_provenance: list[Dict[str, Any]] = []
    for ordinal, canonical in enumerate(reconstruction.canonical_objectives):
        indices_name = f"canonical_objective_{ordinal}_indices"
        values_name = f"canonical_objective_{ordinal}_values"
        additional_arrays[indices_name] = canonical.indices
        additional_arrays[values_name] = canonical.values
        objective_provenance.append(
            {
                **preparation_manifest["objective_normalization"][canonical.layer],
                "canonical_indices_array": indices_name,
                "canonical_values_array": values_name,
            }
        )
    write_compiled_artifact(
        model,
        Path(preparation_output_dir) / "compiled-model",
        problem_definition_hash=resolved_problem_hash,
        candidate_planning_unit_ids=candidate_ids,
        candidate_source_indices=candidate_sources,
        fixed_planning_unit_ids=fixed_ids,
        fixed_source_indices=fixed_sources,
        fixed_values=fixed_values,
        provenance={
            "compiler": "dask-geospatial-compiler-v2-domain-presolve",
            "preparation_schema_version": 6,
            "decision_domain": conditions.decision_domain,
            "preserve_primary_domain": conditions.preserve_primary_domain,
            "allocation_target_row": conditions.allocation_target_row,
            "objectives": objective_provenance,
            "neighbor_penalty": preparation_manifest.get(
                "neighbor_normalization"
            ),
        },
        additional_arrays=additional_arrays,
    )
    _discard_intermediate_sparse_vectors(
        {
            ordinal: canonical.indices
            for ordinal, canonical in enumerate(reconstruction.canonical_objectives)
        },
        {
            ordinal: canonical.values
            for ordinal, canonical in enumerate(reconstruction.canonical_objectives)
        },
        (reconstruction.compiled_primary_objective,),
    )
    return CompilationOutput(
        model=model,
        reconstruction=replace(
            reconstruction,
            compiled_primary_objective=np.empty(0, dtype=np.float64),
            canonical_objectives=(),
        ),
    )


def _compiled_reconstruction_arrays(
    preparation_directory: Path,
    reconstruction: CompilationReconstruction,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Build one canonical candidate mapping and compact fixed reconstruction."""
    mapping = reconstruction.planning_unit_solver_columns
    fixed = reconstruction.planning_unit_fixed_values
    candidate_count = int(np.count_nonzero(mapping >= 0))
    fixed_count = int(np.count_nonzero(fixed >= 0))
    compiled_root = preparation_directory / "compiled-model"
    compiled_root.mkdir(parents=True, exist_ok=True)
    candidate_ids = np.lib.format.open_memmap(
        compiled_root / "candidate_planning_unit_ids.npy",
        mode="w+",
        dtype=np.uint64,
        shape=(candidate_count,),
    )
    candidate_sources = np.lib.format.open_memmap(
        compiled_root / "candidate_source_indices.npy",
        mode="w+",
        dtype=np.int64,
        shape=(candidate_count,),
    )
    fixed_ids = np.lib.format.open_memmap(
        compiled_root / "fixed_planning_unit_ids.npy",
        mode="w+",
        dtype=np.uint64,
        shape=(fixed_count,),
    )
    fixed_values = np.lib.format.open_memmap(
        compiled_root / "fixed_values.npy",
        mode="w+",
        dtype=np.int8,
        shape=(fixed_count,),
    )
    fixed_sources = np.lib.format.open_memmap(
        compiled_root / "fixed_source_indices.npy",
        mode="w+",
        dtype=np.int64,
        shape=(fixed_count,),
    )
    fixed_offset = 0
    for path in sorted((preparation_directory / "planning-units").glob("*.parquet")):
        parquet = pq.ParquetFile(path)
        for batch in parquet.iter_batches(
            batch_size=65536,
            columns=["variable_index", "grid_cell_id"],
        ):
            source_indices = batch.column("variable_index").to_numpy().astype(
                np.int64, copy=False
            )
            planning_ids = batch.column("grid_cell_id").to_numpy().astype(
                np.uint64, copy=False
            )
            solver_columns = mapping[source_indices]
            candidates = solver_columns >= 0
            candidate_ids[solver_columns[candidates]] = planning_ids[candidates]
            candidate_sources[solver_columns[candidates]] = source_indices[candidates]
            fixed_positions = fixed[source_indices] >= 0
            stop = fixed_offset + int(np.count_nonzero(fixed_positions))
            fixed_ids[fixed_offset:stop] = planning_ids[fixed_positions]
            fixed_values[fixed_offset:stop] = fixed[source_indices[fixed_positions]]
            fixed_sources[fixed_offset:stop] = source_indices[fixed_positions]
            fixed_offset = stop
    if fixed_offset != fixed_count:
        raise RuntimeError("Fixed reconstruction count differs from compiled mapping.")
    if candidate_count > 1 and np.any(
        candidate_sources[1:] <= candidate_sources[:-1]
    ):
        raise RuntimeError("Compiled candidate source mapping is not ordered.")
    if fixed_count > 1 and np.any(fixed_sources[1:] <= fixed_sources[:-1]):
        raise RuntimeError("Compiled fixed source mapping is not ordered.")
    return (
        candidate_ids,
        candidate_sources,
        fixed_ids,
        fixed_sources,
        fixed_values,
    )
