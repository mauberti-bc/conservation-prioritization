"""Publish one immutable native-resolution Zarr representation per layer."""

from __future__ import annotations

import hashlib
import json
import math
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import numpy as np
import rasterio
import zarr
from affine import Affine
from rasterio.transform import array_bounds
from rasterio.windows import Window

from .optimization.grid import GRID_FAMILY_ID
from .spatial.resampling import validate_resampling_contract


@dataclass(frozen=True)
class SourceGrid:
    """Optional planning-family metadata retained for publication compatibility."""

    crs: str
    extent: tuple[float, float, float, float]
    base_resolution: int = 30

    @property
    def shape(self) -> tuple[int, int]:
        """Return the planning-family base shape."""
        left, bottom, right, top = self.extent
        return (
            math.ceil((top - bottom) / self.base_resolution),
            math.ceil((right - left) / self.base_resolution),
        )

    @property
    def transform(self) -> Affine:
        """Return the planning-family base transform."""
        left, _, _, top = self.extent
        return Affine(self.base_resolution, 0, left, 0, -self.base_resolution, top)


def publish_analytical_source(
    layers: Mapping[str, str | Path],
    contracts: Mapping[str, Mapping[str, object]],
    output_directory: str | Path,
    *,
    source_name: str,
    source_version: str,
    grid: SourceGrid | None = None,
    tile_size: int = 1024,
) -> Path:
    """Publish native arrays and commit their validated source manifest last."""
    if set(layers) != set(contracts):
        missing = set(layers).symmetric_difference(contracts)
        raise ValueError(
            f"Every layer requires exactly one contract: {sorted(missing)}"
        )
    destination = Path(output_directory)
    attempt = destination / "attempts" / str(uuid.uuid4())
    store_path = attempt / "source.zarr"
    root = zarr.open_group(str(store_path), mode="w")
    descriptors: dict[str, dict[str, object]] = {}
    resolved_contracts: dict[str, dict[str, object]] = {}
    for layer_id, source_path in sorted(layers.items()):
        descriptor, contract = _publish_native_layer(
            root,
            layer_id,
            Path(source_path),
            contracts[layer_id],
            tile_size,
        )
        descriptors[layer_id] = descriptor
        resolved_contracts[layer_id] = contract
    root_metadata: dict[str, object] = {
        "schema_version": 2,
        "source_name": source_name,
        "source_version": source_version,
        "storage_model": "authoritative_native_resolution_v1",
        "layer_descriptors": descriptors,
        "layer_contracts": resolved_contracts,
    }
    if grid is not None:
        root_metadata["planning_grid_family"] = {
            "grid_family_id": GRID_FAMILY_ID,
            "crs": grid.crs,
            "extent": list(grid.extent),
            "base_resolution": grid.base_resolution,
        }
        root_metadata["grid_extent"] = list(grid.extent)
        root_metadata["grid_shape"] = list(grid.shape)
    root.attrs.update(root_metadata)
    zarr.consolidate_metadata(str(store_path))
    _validate_source(root, descriptors)
    content = _directory_parts(store_path)
    schema_metadata = {
        **root_metadata,
        "source_manifest_schema_version": 2,
    }
    manifest = {
        "schema_version": 2,
        "commit_protocol": "manifest_last",
        "source_name": source_name,
        "source_version": source_version,
        "zarr_path": str(store_path.relative_to(destination)),
        "storage_model": "authoritative_native_resolution_v1",
        "layer_descriptors": descriptors,
        "layer_contracts": resolved_contracts,
        "schema_metadata": schema_metadata,
        "parts": content,
        "content_root": hashlib.sha256(
            json.dumps(content, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
    }
    attempt_manifest = attempt / "manifest.json"
    attempt_manifest.write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    destination.mkdir(parents=True, exist_ok=True)
    published = destination / f"{source_version}.published.json"
    published.write_text(
        json.dumps(
            {
                **manifest,
                "manifest_path": str(attempt_manifest.relative_to(destination)),
            },
            sort_keys=True,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    return published


def _publish_native_layer(
    root: zarr.Group,
    layer_id: str,
    source_path: Path,
    contract: Mapping[str, object],
    tile_size: int,
) -> tuple[dict[str, object], dict[str, object]]:
    validate_resampling_contract(contract, layer_id)
    group_path, variable = layer_id.rsplit("/", 1)
    with rasterio.open(source_path) as source:
        if source.count != 1:
            raise ValueError(f"Layer {layer_id} must contain exactly one raster band.")
        transform = source.transform
        crs = source.crs
        if crs is None:
            raise ValueError(f"Layer {layer_id} does not declare a CRS.")
        native_resolution = (
            math.hypot(transform.a, transform.d) + math.hypot(transform.b, transform.e)
        ) / 2.0
        declared_resolution = contract.get("native_resolution") or contract.get(
            "evidence_resolution"
        )
        if declared_resolution is not None and not math.isclose(
            float(declared_resolution),
            native_resolution,
            rel_tol=0.0,
            abs_tol=1e-4,
        ):
            raise ValueError(
                f"Layer {layer_id} declares {declared_resolution} m evidence but "
                f"its affine transform measures {native_resolution:g} m."
            )
        group = root.require_group(group_path)
        _ensure_group_coordinates(
            group,
            transform,
            source.height,
            source.width,
            tile_size,
            crs.to_string(),
        )
        chunks = (
            min(tile_size, source.height),
            min(tile_size, source.width),
        )
        array = group.create_dataset(
            variable,
            shape=(source.height, source.width),
            chunks=chunks,
            dtype="f4",
            fill_value=np.nan,
            compressor=zarr.Blosc(cname="zstd", clevel=5, shuffle=1),
        )
        resolved_contract = {
            **contract,
            "schema_version": 1,
            "layer_id": layer_id,
            "native_crs": crs.to_string(),
            "native_transform": list(transform.to_gdal()),
            "native_shape": [source.height, source.width],
            "native_resolution": native_resolution,
            "native_orientation": (
                "north_to_south" if transform.e < 0 else "south_to_north"
            ),
            "native_bounds": list(array_bounds(source.height, source.width, transform)),
            "native_chunks": list(chunks),
            "native_dtype": "float32",
            "coarse_to_fine_policy": contract.get("coarse_to_fine_policy", "prohibit"),
            "mapping_contract_version": contract.get(
                "mapping_contract_version", "native-affine-v1"
            ),
        }
        array.attrs.update(
            {
                "_ARRAY_DIMENSIONS": ["y", "x"],
                "grid_mapping": "spatial_ref",
                "representation_contract": resolved_contract,
            }
        )
        for row_start in range(0, source.height, tile_size):
            for col_start in range(0, source.width, tile_size):
                row_stop = min(row_start + tile_size, source.height)
                col_stop = min(col_start + tile_size, source.width)
                window = Window(
                    col_start,
                    row_start,
                    col_stop - col_start,
                    row_stop - row_start,
                )
                block = source.read(1, window=window, masked=True)
                array[row_start:row_stop, col_start:col_stop] = np.asarray(
                    block.filled(np.nan), dtype=np.float32
                )
        descriptor = {
            "layer_id": layer_id,
            "array_path": layer_id,
            "crs": crs.to_string(),
            "transform": list(transform.to_gdal()),
            "width": source.width,
            "height": source.height,
            "native_resolution": native_resolution,
            "orientation": resolved_contract["native_orientation"],
            "bounds": resolved_contract["native_bounds"],
            "chunks": list(chunks),
            "dtype": "float32",
            "nodata": source.nodata,
            "mapping_contract_version": resolved_contract["mapping_contract_version"],
        }
        return descriptor, resolved_contract


def _ensure_group_coordinates(
    group: zarr.Group,
    transform: Affine,
    height: int,
    width: int,
    chunk_size: int,
    crs: str,
) -> None:
    expected_x = transform.c + (np.arange(width) + 0.5) * transform.a
    expected_y = transform.f + (np.arange(height) + 0.5) * transform.e
    if "x" in group or "y" in group:
        if (
            "x" not in group
            or "y" not in group
            or group["x"].shape != (width,)
            or group["y"].shape != (height,)
            or not np.allclose(group["x"][:], expected_x)
            or not np.allclose(group["y"][:], expected_y)
        ):
            raise ValueError(
                "Layers sharing a Zarr group must share one native affine grid."
            )
        return
    x = group.create_dataset(
        "x", shape=(width,), chunks=(min(chunk_size, width),), dtype="f8"
    )
    y = group.create_dataset(
        "y", shape=(height,), chunks=(min(chunk_size, height),), dtype="f8"
    )
    x[:] = expected_x
    y[:] = expected_y
    x.attrs["_ARRAY_DIMENSIONS"] = ["x"]
    y.attrs["_ARRAY_DIMENSIONS"] = ["y"]
    spatial_ref = group.create_dataset("spatial_ref", shape=(), dtype="i4")
    spatial_ref[()] = 0
    crs_wkt = rasterio.crs.CRS.from_user_input(crs).to_wkt()
    spatial_ref.attrs.update(
        {
            "_ARRAY_DIMENSIONS": [],
            "spatial_ref": crs_wkt,
            "crs_wkt": crs_wkt,
        }
    )


def _validate_source(
    root: zarr.Group, descriptors: Mapping[str, Mapping[str, object]]
) -> None:
    for layer_id, descriptor in descriptors.items():
        array = root[layer_id]
        if list(array.shape) != [descriptor["height"], descriptor["width"]]:
            raise RuntimeError(f"Published native shape differs for {layer_id}.")
        if list(array.chunks) != descriptor["chunks"]:
            raise RuntimeError(f"Published native chunks differ for {layer_id}.")


def _directory_parts(directory: Path) -> list[dict[str, object]]:
    parts = []
    for path in sorted(value for value in directory.rglob("*") if value.is_file()):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        parts.append(
            {
                "path": str(path.relative_to(directory)),
                "checksum": digest,
                "size_bytes": path.stat().st_size,
            }
        )
    return parts
