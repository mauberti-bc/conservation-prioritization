from __future__ import annotations

import heapq
import io
import json
import math
import os
import struct
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Sequence

import matplotlib.pyplot as plt
import numpy as np
import zarr
from affine import Affine
from morecantile import defaults
from morecantile.commons import Tile
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from pyproj import Transformer
from rasterio.transform import array_bounds, from_bounds
from rasterio.warp import Resampling, reproject
from rasterio.windows import from_bounds as window_from_bounds

_TILE_RUN_HEADER = struct.Struct(">QI")


@dataclass(frozen=True)
class RenderBatch:
    """A uniquely owned rectangular group of destination map tiles."""

    zoom: int
    x_start: int
    x_stop: int
    y_start: int
    y_stop: int

    @property
    def tile_count(self) -> int:
        """Return the number of destination tiles owned by this batch."""
        return (self.x_stop - self.x_start) * (self.y_stop - self.y_start)


@dataclass(frozen=True)
class RenderSpecification:
    """Immutable configuration and spatial metadata for one tileset render."""

    canonical_path: str
    transform: tuple[float, float, float, float, float, float]
    crs: str
    bounds: tuple[float, float, float, float]
    min_zoom: int
    max_zoom: int
    tile_size: int
    metatile_size: int
    maximum_source_window: int
    png_compress_level: int
    canonical_checksum: str | None
    surface: str


@dataclass(frozen=True)
class RenderBatchResult:
    """Compact result metadata for one disk-backed tile run."""

    path: str
    rendered_tile_count: int
    first_tile_id: int | None
    last_tile_id: int | None


def prepare_windowed_pmtiles(
    canonical_path: str | Path,
    *,
    min_zoom: int,
    max_zoom: int,
    tile_size: int = 512,
    metatile_size: int = 3,
    maximum_source_window: int = 2048,
    png_compress_level: int | None = None,
) -> tuple[RenderSpecification, list[RenderBatch]]:
    """Build a deterministic, destination-owned render plan.

    Each batch owns every output tile in its half-open x/y range. Source Zarr
    chunks may be shared by batches, but no output tile can be emitted twice.
    """
    if min_zoom < 0 or max_zoom < min_zoom:
        raise ValueError("PMTiles zoom bounds are invalid.")
    if tile_size <= 0 or metatile_size <= 0 or maximum_source_window <= 0:
        raise ValueError("Tile, metatile, and source-window sizes must be positive.")
    resolved_compress_level = (
        int(os.getenv("PMTILES_PNG_COMPRESS_LEVEL", "3"))
        if png_compress_level is None
        else png_compress_level
    )
    if resolved_compress_level < 0 or resolved_compress_level > 9:
        raise ValueError("PNG compression level must be between zero and nine.")

    canonical = Path(canonical_path)
    root = zarr.open_group(str(canonical), mode="r")
    surface = str(root.attrs.get("surface", "decision"))
    if surface not in root:
        raise ValueError("Canonical result does not contain its declared surface.")
    base = root[surface]
    transform = Affine.from_gdal(*root.attrs["transform"])
    crs = str(root.attrs["crs"])
    native_bounds = array_bounds(base.shape[-2], base.shape[-1], transform)
    to_wgs84 = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    bounds = tuple(
        float(value)
        for value in to_wgs84.transform_bounds(*native_bounds, densify_pts=21)
    )
    manifest_path = canonical / "manifest.json"
    canonical_manifest = (
        json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest_path.exists()
        else {}
    )
    specification = RenderSpecification(
        canonical_path=str(canonical),
        transform=tuple(float(value) for value in transform.to_gdal()),
        crs=crs,
        bounds=bounds,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        tile_size=tile_size,
        metatile_size=metatile_size,
        maximum_source_window=maximum_source_window,
        png_compress_level=resolved_compress_level,
        canonical_checksum=canonical_manifest.get("content_root"),
        surface=surface,
    )
    west, south, east, north = bounds
    tms = defaults.tms.get("WebMercatorQuad")
    batches: list[RenderBatch] = []
    for zoom in range(min_zoom, max_zoom + 1):
        upper_left = tms.tile(west, north, zoom)
        lower_right = tms.tile(east, south, zoom)
        x_limit = lower_right.x + 1
        y_limit = lower_right.y + 1
        for x_start in range(upper_left.x, x_limit, metatile_size):
            for y_start in range(upper_left.y, y_limit, metatile_size):
                batches.append(
                    RenderBatch(
                        zoom=zoom,
                        x_start=x_start,
                        x_stop=min(x_start + metatile_size, x_limit),
                        y_start=y_start,
                        y_stop=min(y_start + metatile_size, y_limit),
                    )
                )
    return specification, batches


def render_windowed_pmtiles_batch(
    specification: RenderSpecification | dict[str, Any],
    batch: RenderBatch | dict[str, int],
    output_path: str | Path,
) -> RenderBatchResult:
    """Render one bounded metatile and persist a sorted tile run on disk."""
    resolved_specification = (
        RenderSpecification(**specification)
        if isinstance(specification, dict)
        else specification
    )
    resolved_batch = RenderBatch(**batch) if isinstance(batch, dict) else batch
    root = _open_canonical_group(resolved_specification.canonical_path)
    records = _render_metatile(root, resolved_specification, resolved_batch)
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    _write_tile_run(destination, records)
    return RenderBatchResult(
        path=str(destination),
        rendered_tile_count=len(records),
        first_tile_id=records[0][0] if records else None,
        last_tile_id=records[-1][0] if records else None,
    )


def finalize_windowed_pmtiles(
    specification: RenderSpecification | dict[str, Any],
    run_paths: Sequence[str | Path],
    output_path: str | Path,
    *,
    maximum_merge_fan_in: int = 64,
) -> Path:
    """Merge sorted tile runs and write one deterministic PMTiles archive."""
    if maximum_merge_fan_in < 2:
        raise ValueError("PMTiles merge fan-in must be at least two.")
    resolved_specification = (
        RenderSpecification(**specification)
        if isinstance(specification, dict)
        else specification
    )
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    merge_directory = destination.parent / f".{destination.name}.merge"
    merge_directory.mkdir(parents=True, exist_ok=True)
    merged_runs = _reduce_tile_runs(
        [Path(path) for path in run_paths], merge_directory, maximum_merge_fan_in
    )
    rendered_tile_count = 0
    with destination.open("wb") as target:
        writer = Writer(target)
        previous_tile_id: int | None = None
        for tile_id, tile_bytes in _merge_tile_run_records(merged_runs):
            if previous_tile_id == tile_id:
                raise RuntimeError(f"Duplicate destination tile ID: {tile_id}.")
            writer.write_tile(tile_id, tile_bytes)
            previous_tile_id = tile_id
            rendered_tile_count += 1
        if rendered_tile_count == 0:
            west, south, east, north = resolved_specification.bounds
            tms = defaults.tms.get("WebMercatorQuad")
            empty_tile = tms.tile(
                (west + east) / 2,
                (south + north) / 2,
                resolved_specification.min_zoom,
            )
            writer.write_tile(
                zxy_to_tileid(empty_tile.z, empty_tile.x, empty_tile.y),
                _transparent_png(
                    resolved_specification.tile_size,
                    resolved_specification.png_compress_level,
                ),
            )
        writer.finalize(
            header={
                "tile_compression": Compression.NONE,
                "tile_type": TileType.PNG,
                "min_zoom": resolved_specification.min_zoom,
                "max_zoom": resolved_specification.max_zoom,
            },
            metadata=_tileset_metadata(resolved_specification, rendered_tile_count),
        )
    return destination


def create_windowed_pmtiles(
    canonical_path: str | Path,
    output_path: str | Path,
    *,
    min_zoom: int,
    max_zoom: int,
    tile_size: int = 512,
    metatile_size: int = 3,
    maximum_source_window: int = 2048,
    png_compress_level: int | None = None,
) -> Path:
    """Render bounded metatiles serially and pack their disk-backed tile runs."""
    specification, batches = prepare_windowed_pmtiles(
        canonical_path,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        tile_size=tile_size,
        metatile_size=metatile_size,
        maximum_source_window=maximum_source_window,
        png_compress_level=png_compress_level,
    )
    output = Path(output_path)
    run_directory = output.parent / f".{output.name}.runs"
    run_paths: list[Path] = []
    for index, batch in enumerate(batches):
        run_path = run_directory / f"batch-{index:08d}.tiles"
        render_windowed_pmtiles_batch(specification, batch, run_path)
        run_paths.append(run_path)
    return finalize_windowed_pmtiles(specification, run_paths, output)


def _render_metatile(
    root: zarr.Group,
    specification: RenderSpecification,
    batch: RenderBatch,
) -> list[tuple[int, bytes]]:
    """Read and warp the union source window for one destination metatile."""
    tms = defaults.tms.get("WebMercatorQuad")
    upper_left_bounds = tms.bounds(Tile(batch.x_start, batch.y_start, batch.zoom))
    lower_right_bounds = tms.bounds(
        Tile(batch.x_stop - 1, batch.y_stop - 1, batch.zoom)
    )
    to_source = _to_source_transformer(specification.crs)
    source_bounds = to_source.transform_bounds(
        upper_left_bounds.left,
        lower_right_bounds.bottom,
        lower_right_bounds.right,
        upper_left_bounds.top,
        densify_pts=21,
    )
    base_transform = Affine.from_gdal(*specification.transform)
    base_window = window_from_bounds(*source_bounds, transform=base_transform)
    destination_width = (batch.x_stop - batch.x_start) * specification.tile_size
    destination_height = (batch.y_stop - batch.y_start) * specification.tile_size
    ratio = max(
        base_window.width / destination_width,
        base_window.height / destination_height,
    )
    factor, source = _select_overview(
        root,
        ratio,
    )
    source_transform = base_transform * Affine.scale(factor)
    window = window_from_bounds(*source_bounds, transform=source_transform)
    row_start = max(0, math.floor(window.row_off) - 1)
    col_start = max(0, math.floor(window.col_off) - 1)
    row_stop = min(source.shape[-2], math.ceil(window.row_off + window.height) + 1)
    col_stop = min(source.shape[-1], math.ceil(window.col_off + window.width) + 1)
    if row_start >= row_stop or col_start >= col_stop:
        return []
    batch_scale = max(
        batch.x_stop - batch.x_start,
        batch.y_stop - batch.y_start,
    )
    if (
        row_stop - row_start > specification.maximum_source_window * batch_scale + 2
        or col_stop - col_start > specification.maximum_source_window * batch_scale + 2
    ):
        raise RuntimeError(
            "Result overviews are insufficient to keep a metatile read bounded."
        )

    dtype = np.uint8 if specification.surface == "decision" else np.float32
    source_values = np.asarray(
        source[slice(row_start, row_stop), slice(col_start, col_stop)],
        dtype=dtype,
    )
    if specification.surface == "decision" and not np.any(source_values != 255):
        return []
    if specification.surface in {"allocation", "priority"} and not np.any(
        np.isfinite(source_values)
    ):
        return []

    window_transform = source_transform * Affine.translation(col_start, row_start)
    upper_left_web = tms.xy_bounds(Tile(batch.x_start, batch.y_start, batch.zoom))
    lower_right_web = tms.xy_bounds(
        Tile(batch.x_stop - 1, batch.y_stop - 1, batch.zoom)
    )
    destination_transform = from_bounds(
        upper_left_web.left,
        lower_right_web.bottom,
        lower_right_web.right,
        upper_left_web.top,
        destination_width,
        destination_height,
    )
    destination = np.full(
        (destination_height, destination_width),
        255 if specification.surface == "decision" else np.nan,
        dtype=dtype,
    )
    reproject(
        source_values,
        destination,
        src_transform=window_transform,
        src_crs=specification.crs,
        src_nodata=255 if specification.surface == "decision" else np.nan,
        dst_transform=destination_transform,
        dst_crs="EPSG:3857",
        dst_nodata=255 if specification.surface == "decision" else np.nan,
        resampling=(
            Resampling.nearest
            if specification.surface == "decision"
            else Resampling.bilinear
        ),
    )
    rgba = _style_destination(destination, specification.surface)
    if rgba is None:
        return []

    records: list[tuple[int, bytes]] = []
    for x in range(batch.x_start, batch.x_stop):
        for y in range(batch.y_start, batch.y_stop):
            row_offset = (y - batch.y_start) * specification.tile_size
            column_offset = (x - batch.x_start) * specification.tile_size
            tile_rgba = rgba[
                row_offset : row_offset + specification.tile_size,
                column_offset : column_offset + specification.tile_size,
            ]
            if not np.any(tile_rgba[..., 3]):
                continue
            buffer = io.BytesIO()
            Image.fromarray(tile_rgba).save(
                buffer,
                format="PNG",
                compress_level=specification.png_compress_level,
            )
            records.append((zxy_to_tileid(batch.zoom, x, y), buffer.getvalue()))
    records.sort(key=lambda item: item[0])
    return records


def _style_destination(
    destination: np.ndarray, surface: str = "decision"
) -> np.ndarray | None:
    """Style decision or allocation surfaces and keep NoData transparent."""
    rgba = np.zeros((*destination.shape, 4), dtype=np.uint8)
    if surface in {"allocation", "priority"}:
        valid = np.isfinite(destination)
        if not np.any(valid):
            return None
        clipped = np.clip(destination, 0.0, 1.0)
        colours = plt.get_cmap("viridis" if surface == "allocation" else "magma")(
            clipped
        )
        rgba[valid] = np.asarray(np.round(colours[valid] * 255), dtype=np.uint8)
        rgba[valid, 3] = np.asarray(80 + np.round(clipped[valid] * 175), dtype=np.uint8)
        return rgba
    considered = destination == 0
    selected = destination == 1
    if not np.any(considered | selected):
        return None
    rgba[considered] = np.asarray([160, 160, 160, 180], dtype=np.uint8)
    colour = plt.get_cmap("viridis")(0.85)
    rgba[selected] = np.asarray(
        [
            round(colour[0] * 255),
            round(colour[1] * 255),
            round(colour[2] * 255),
            220,
        ],
        dtype=np.uint8,
    )
    return rgba


def _select_overview(
    root: zarr.Group,
    source_to_tile_ratio: float,
) -> tuple[int, zarr.Array]:
    """Choose the first overview no finer than the destination pixel grid."""
    surface = str(root.attrs.get("surface", "decision"))
    candidates: list[tuple[int, zarr.Array]] = [(1, root[surface])]
    if "overviews" in root:
        overview_group = root["overviews"]
        candidates.extend(
            (int(name), overview_group[name]) for name in overview_group.array_keys()
        )
    candidates.sort(key=lambda item: item[0])
    desired = max(1, math.ceil(source_to_tile_ratio))
    for factor, array in candidates:
        if factor >= desired:
            return factor, array
    return candidates[-1]


@lru_cache(maxsize=16)
def _to_source_transformer(source_crs: str) -> Transformer:
    """Reuse immutable CRS transformers across batches in each render worker."""
    return Transformer.from_crs("EPSG:4326", source_crs, always_xy=True)


@lru_cache(maxsize=8)
def _open_canonical_group(canonical_path: str) -> zarr.Group:
    """Reuse read-only Zarr metadata and stores across batches in each worker."""
    return zarr.open_group(canonical_path, mode="r")


def _write_tile_run(path: Path, records: Sequence[tuple[int, bytes]]) -> None:
    """Write sorted tile records using a small streamable binary framing format."""
    with path.open("wb") as target:
        for tile_id, tile_bytes in records:
            target.write(_TILE_RUN_HEADER.pack(tile_id, len(tile_bytes)))
            target.write(tile_bytes)


def _iter_tile_run(path: Path) -> Iterator[tuple[int, bytes]]:
    """Yield tile records from one disk-backed run."""
    with path.open("rb") as source:
        while True:
            header = source.read(_TILE_RUN_HEADER.size)
            if not header:
                return
            if len(header) != _TILE_RUN_HEADER.size:
                raise RuntimeError(f"Truncated PMTiles run header: {path}.")
            tile_id, length = _TILE_RUN_HEADER.unpack(header)
            tile_bytes = source.read(length)
            if len(tile_bytes) != length:
                raise RuntimeError(f"Truncated PMTiles run payload: {path}.")
            yield tile_id, tile_bytes


def _merge_tile_run_records(
    paths: Sequence[Path],
) -> Iterator[tuple[int, bytes]]:
    """K-way merge sorted tile runs without retaining their payloads in memory."""
    iterators = [_iter_tile_run(path) for path in paths]
    yield from heapq.merge(*iterators, key=lambda item: item[0])


def _reduce_tile_runs(
    paths: list[Path], merge_directory: Path, maximum_fan_in: int
) -> list[Path]:
    """Reduce tile runs to one exact stream with bounded open-file fan-in."""
    current = paths
    level = 0
    while len(current) > 1:
        next_level: list[Path] = []
        for index in range(0, len(current), maximum_fan_in):
            output = merge_directory / f"level-{level}-{index // maximum_fan_in}.tiles"
            _write_tile_run(
                output,
                _merge_tile_run_records(current[index : index + maximum_fan_in]),
            )
            next_level.append(output)
        current = next_level
        level += 1
    return current


def _tileset_metadata(
    specification: RenderSpecification, rendered_tile_count: int
) -> dict[str, Any]:
    """Build PMTiles metadata from immutable render inputs."""
    west, south, east, north = specification.bounds
    surface = specification.surface
    return {
        "format": "png",
        "bounds": [west, south, east, north],
        "center": [
            (west + east) / 2,
            (south + north) / 2,
            specification.min_zoom,
        ],
        "tilejson": "2.2.0",
        "type": "overlay",
        "name": "Conservation prioritization result",
        "minzoom": specification.min_zoom,
        "maxzoom": specification.max_zoom,
        "canonical_format": "zarr-v2",
        "empty": rendered_tile_count == 0,
        "rendered_tile_count": rendered_tile_count,
        "surface": surface,
        "overview_statistic": (
            {
                "decision": "any_selected_v1",
                "allocation": "maximum_allocation_v1",
                "priority": "mean_priority_v1",
            }[surface]
        ),
        "color_ramp": (
            {
                "decision": "decision_selected_viridis_unselected_gray_v2",
                "allocation": "allocation_viridis_continuous_v1",
                "priority": "priority_magma_continuous_v1",
            }[surface]
        ),
        "source_canonical_checksum": specification.canonical_checksum,
        "render_metatile_size": specification.metatile_size,
        "png_compress_level": specification.png_compress_level,
    }


def _transparent_png(tile_size: int, compress_level: int = 3) -> bytes:
    """Encode one transparent fallback tile."""
    buffer = io.BytesIO()
    Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0)).save(
        buffer, format="PNG", compress_level=compress_level
    )
    return buffer.getvalue()
