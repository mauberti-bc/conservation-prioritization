from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Literal, Sequence

import numpy as np
import pyarrow.parquet as pq
import zarr

ResultSurface = Literal["decision", "allocation", "priority"]


def write_solver_canonical_zarr(
    output_path: str | Path,
    planning_paths: Sequence[str | Path],
    decisions: np.ndarray,
    *,
    height: int,
    width: int,
    chunk_size: int,
    transform: Sequence[float],
    crs: str,
    planning_unit_resolution: int,
    grid_family_id: str,
    grid_level: int,
    full_grid_width: int | None = None,
    global_row_offset: int = 0,
    global_col_offset: int = 0,
    surface: ResultSurface = "decision",
) -> Path:
    """Write solver decisions to the canonical spatial result."""
    if surface not in {"decision", "allocation", "priority"}:
        raise ValueError(
            "Canonical result surface must be decision, allocation, or priority."
        )
    destination = Path(output_path)
    destination.mkdir(parents=True, exist_ok=True)
    root = zarr.open_group(str(destination), mode="w")
    fill_value = 255 if surface == "decision" else np.nan
    dtype = "u1" if surface == "decision" else "f4"
    values = root.create_dataset(
        surface,
        shape=(height, width),
        chunks=(min(chunk_size, height), min(chunk_size, width)),
        dtype=dtype,
        fill_value=fill_value,
        compressor=zarr.Blosc(cname="zstd", clevel=5, shuffle=1),
    )
    for path in sorted(Path(value) for value in planning_paths):
        parquet = pq.ParquetFile(path)
        for batch in parquet.iter_batches(
            batch_size=65536, columns=["variable_index", "row", "col"]
        ):
            indices = batch.column("variable_index").to_numpy().astype(np.int64)
            rows = batch.column("row").to_numpy().astype(np.int64)
            cols = batch.column("col").to_numpy().astype(np.int64)
            if surface == "decision":
                values.vindex[rows, cols] = np.asarray(
                    decisions[indices] >= 0.5, dtype=np.uint8
                )
            elif surface == "allocation":
                values.vindex[rows, cols] = np.asarray(
                    np.clip(decisions[indices], 0.0, 1.0), dtype=np.float32
                )
            else:
                values.vindex[rows, cols] = np.asarray(
                    np.clip(decisions[indices], 0.0, 1.0), dtype=np.float32
                )
    surface_semantics: dict[str, object]
    if surface == "decision":
        surface_semantics = {
            "not_selected": 0,
            "selected": 1,
            "outside_aoi": 255,
        }
    elif surface == "allocation":
        surface_semantics = {
            "minimum_allocation": 0.0,
            "maximum_allocation": 1.0,
            "outside_aoi": "NaN",
        }
    else:
        surface_semantics = {
            "minimum_priority": 0.0,
            "maximum_priority": 1.0,
            "outside_aoi": "NaN",
            "score": "mean_nested_allocation_v1",
        }
    attributes = {
        "schema_version": 1,
        "surface": surface,
        "grid_family_id": grid_family_id,
        "grid_level": grid_level,
        "crs": crs,
        "transform": list(transform),
        "planning_unit_resolution": planning_unit_resolution,
        "surface_semantics": surface_semantics,
        "full_grid_width": full_grid_width or width,
        "global_row_offset": global_row_offset,
        "global_col_offset": global_col_offset,
    }
    if surface == "decision":
        attributes["decision_semantics"] = surface_semantics
    root.attrs.update(attributes)
    _build_surface_overviews(root, surface, chunk_size)
    zarr.consolidate_metadata(str(destination))
    manifest = _directory_manifest(destination)
    (destination / "manifest.json").write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    return destination


def _build_surface_overviews(
    root: zarr.Group, surface: ResultSurface, chunk_size: int
) -> None:
    """Build bounded factor-two overviews for low-zoom map reads."""
    overview_group = root.create_group("overviews")
    source = root[surface]
    factor = 2
    while source.shape[0] > 512 or source.shape[1] > 512:
        target_shape = ((source.shape[0] + 1) // 2, (source.shape[1] + 1) // 2)
        dtype = "u1" if surface == "decision" else "f4"
        fill_value = 255 if surface == "decision" else np.nan
        target = overview_group.create_dataset(
            str(factor),
            shape=target_shape,
            chunks=(min(chunk_size, target_shape[0]), min(chunk_size, target_shape[1])),
            dtype=dtype,
            fill_value=fill_value,
            compressor=zarr.Blosc(cname="zstd", clevel=5, shuffle=1),
        )
        for row_start in range(0, target_shape[0], chunk_size):
            for col_start in range(0, target_shape[1], chunk_size):
                row_stop = min(row_start + chunk_size, target_shape[0])
                col_stop = min(col_start + chunk_size, target_shape[1])
                block = np.asarray(
                    source[
                        row_start * 2 : min(row_stop * 2, source.shape[0]),
                        col_start * 2 : min(col_stop * 2, source.shape[1]),
                    ]
                )
                if surface == "decision":
                    padded = np.full(
                        ((row_stop - row_start) * 2, (col_stop - col_start) * 2),
                        255,
                        dtype=np.uint8,
                    )
                else:
                    padded = np.full(
                        ((row_stop - row_start) * 2, (col_stop - col_start) * 2),
                        np.nan,
                        dtype=np.float32,
                    )
                padded[: block.shape[0], : block.shape[1]] = block
                cells = padded.reshape(row_stop - row_start, 2, col_stop - col_start, 2)
                if surface == "decision":
                    any_selected = np.any(cells == 1, axis=(1, 3))
                    any_valid = np.any(cells != 255, axis=(1, 3))
                    reduced = np.full(any_valid.shape, 255, dtype=np.uint8)
                    reduced[any_valid] = 0
                    reduced[any_selected] = 1
                elif surface == "allocation":
                    with np.errstate(all="ignore"):
                        reduced = np.nanmax(cells, axis=(1, 3)).astype(np.float32)
                else:
                    valid = np.isfinite(cells)
                    count = np.sum(valid, axis=(1, 3))
                    total = np.nansum(cells, axis=(1, 3))
                    reduced = np.full(count.shape, np.nan, dtype=np.float32)
                    populated = count > 0
                    reduced[populated] = (
                        total[populated] / count[populated]
                    ).astype(np.float32)
                target[row_start:row_stop, col_start:col_stop] = reduced
        target.attrs["scale_factor"] = factor
        target.attrs["overview_statistic"] = (
            {
                "decision": "any_selected_v1",
                "allocation": "maximum_allocation_v1",
                "priority": "mean_priority_v1",
            }[surface]
        )
        source = target
        factor *= 2


def _sha256(path: Path) -> str:
    """Return the SHA-256 checksum of one canonical result part."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _directory_manifest(directory: Path) -> dict[str, object]:
    """Create the manifest-last integrity record for a Zarr directory."""
    parts = [
        {
            "path": str(path.relative_to(directory)),
            "checksum": _sha256(path),
            "size_bytes": path.stat().st_size,
        }
        for path in sorted(value for value in directory.rglob("*") if value.is_file())
        if path.name != "manifest.json"
    ]
    content_root = hashlib.sha256(
        json.dumps(parts, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "schema_version": 1,
        "format": "zarr-v2",
        "commit_protocol": "manifest_last",
        "content_root": content_root,
        "partition_count": len(parts),
        "partitions": parts,
    }
