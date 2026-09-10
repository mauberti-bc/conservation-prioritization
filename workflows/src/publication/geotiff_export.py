from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
import zarr
from affine import Affine

from ..utils.object_store import build_object_key, get_object_store_config, put_object


PART_SIZE_PIXELS = 4096
BLOCK_SIZE_PIXELS = 512


@dataclass(frozen=True)
class GeoTiffPart:
    """Metadata for one deterministic GeoTIFF export part."""

    part_index: int
    filename: str
    path: Path
    row_offset: int
    column_offset: int
    width: int
    height: int
    transform: Affine
    checksum: str
    byte_size: int
    object_key: str
    crs: str
    dtype: str
    nodata: int | float


def write_geotiff_parts(
    *,
    export_id: str,
    canonical_path: Path,
    output_directory: Path,
) -> list[GeoTiffPart]:
    """Write deterministic GeoTIFF parts from a canonical Zarr result."""
    root = zarr.open_group(str(canonical_path), mode="r")
    surface = str(root.attrs.get("surface", "decision"))
    if surface not in root:
        raise ValueError(f'Canonical surface "{surface}" is not present.')

    values = root[surface]
    crs = str(root.attrs["crs"])
    transform = Affine.from_gdal(*(float(value) for value in root.attrs["transform"]))
    nodata = 255 if values.dtype == np.dtype("uint8") else np.nan
    output_directory.mkdir(parents=True, exist_ok=True)

    parts: list[GeoTiffPart] = []
    part_index = 0
    for row_offset in range(0, values.shape[0], PART_SIZE_PIXELS):
        for column_offset in range(0, values.shape[1], PART_SIZE_PIXELS):
            height = min(PART_SIZE_PIXELS, values.shape[0] - row_offset)
            width = min(PART_SIZE_PIXELS, values.shape[1] - column_offset)
            window_transform = transform * Affine.translation(
                column_offset,
                row_offset,
            )
            filename = (
                f"{surface}_y{row_offset:06d}_x{column_offset:06d}.tif"
            )
            path = output_directory / filename
            data = np.asarray(
                values[
                    row_offset : row_offset + height,
                    column_offset : column_offset + width,
                ]
            )
            _write_geotiff(
                path=path,
                data=data,
                crs=crs,
                transform=window_transform,
                nodata=nodata,
            )
            checksum = _sha256(path)
            object_key = build_object_key(
                f"task-exports/{export_id}/parts/{filename}"
            )
            parts.append(
                GeoTiffPart(
                    part_index=part_index,
                    filename=filename,
                    path=path,
                    row_offset=row_offset,
                    column_offset=column_offset,
                    width=width,
                    height=height,
                    transform=window_transform,
                    checksum=checksum,
                    byte_size=path.stat().st_size,
                    object_key=object_key,
                    crs=crs,
                    dtype=str(values.dtype),
                    nodata=nodata,
                )
            )
            part_index += 1
    return parts


def upload_geotiff_part(
    *,
    export_id: str,
    task_run_id: str,
    part: GeoTiffPart,
    surface: str,
) -> dict[str, Any]:
    """Upload one GeoTIFF part and return API file metadata."""
    config = get_object_store_config()
    put_object(
        local_path=str(part.path),
        bucket=config.bucket,
        key=part.object_key,
        content_type="image/tiff",
        metadata={
            "task_export_id": export_id,
            "task_run_id": task_run_id,
            "part_index": str(part.part_index),
            "sha256": part.checksum,
            "surface": surface,
        },
    )
    return {
        "part_index": part.part_index,
        "filename": part.filename,
        "object_key": part.object_key,
        "content_type": "image/tiff",
        "byte_size": part.byte_size,
        "checksum": part.checksum,
        "row_offset": part.row_offset,
        "column_offset": part.column_offset,
        "width": part.width,
        "height": part.height,
        "transform": {"gdal": list(part.transform.to_gdal())},
        "metadata": {
            "surface": surface,
            "crs": part.crs,
            "dtype": part.dtype,
            "nodata": (
                "NaN"
                if isinstance(part.nodata, float) and np.isnan(part.nodata)
                else part.nodata
            ),
            "format": "geotiff",
            "format_version": "geotiff-v1",
        },
    }


def export_resource_admission(canonical_path: Path) -> dict[str, Any]:
    """Return an inspectable v1 resource admission record."""
    root = zarr.open_group(str(canonical_path), mode="r")
    surface = str(root.attrs.get("surface", "decision"))
    values = root[surface]
    bytes_per_cell = int(np.dtype(values.dtype).itemsize)
    part_bytes = min(PART_SIZE_PIXELS, values.shape[0]) * min(
        PART_SIZE_PIXELS,
        values.shape[1],
    ) * bytes_per_cell
    return {
        "schema_version": 1,
        "status": "accepted",
        "method": "bounded_geotiff_part_v1",
        "surface": surface,
        "dtype": str(values.dtype),
        "shape": [int(values.shape[0]), int(values.shape[1])],
        "chunks": [int(values.chunks[0]), int(values.chunks[1])],
        "part_size_pixels": PART_SIZE_PIXELS,
        "estimated_part_array_bytes": int(part_bytes),
    }


def canonical_surface(canonical_path: Path) -> str:
    """Return the named canonical surface to export."""
    return str(
        zarr.open_group(str(canonical_path), mode="r").attrs.get(
            "surface",
            "decision",
        )
    )


def _write_geotiff(
    *,
    path: Path,
    data: np.ndarray,
    crs: str,
    transform: Affine,
    nodata: int | float,
) -> None:
    """Write one tiled, lossless GeoTIFF."""
    with rasterio.Env(GDAL_NUM_THREADS="1", GDAL_CACHEMAX=64):
        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            height=data.shape[0],
            width=data.shape[1],
            count=1,
            dtype=data.dtype,
            crs=crs,
            transform=transform,
            nodata=nodata,
            tiled=True,
            blockxsize=BLOCK_SIZE_PIXELS,
            blockysize=BLOCK_SIZE_PIXELS,
            compress="DEFLATE",
            num_threads="1",
        ) as dataset:
            dataset.write(data, 1)


def _sha256(path: Path) -> str:
    """Return the SHA-256 checksum of one export file."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
