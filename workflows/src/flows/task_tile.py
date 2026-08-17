from __future__ import annotations

import hashlib
import os
from dataclasses import asdict
from pathlib import Path
from typing import Any

import zarr
from dask.distributed import LocalCluster
from prefect import flow, get_run_logger, task
from prefect.runtime import flow_run
from prefect_dask.task_runners import DaskTaskRunner

from ..publication.windowed_pmtiles import (
    finalize_windowed_pmtiles,
    prepare_windowed_pmtiles,
    render_windowed_pmtiles_batch,
)
from ..utils.internal_api import internal_api_request
from ..utils.object_store import (
    build_object_key,
    download_object,
    get_object_store_config,
    parse_uri,
    put_object,
)
from ..utils.resolution import resolution_to_max_zoom


def _sha256(path: Path) -> str:
    """Return the SHA-256 checksum of one publication file."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_canonical_zarr(artifact: dict[str, Any], output: Path) -> Path:
    """Download and verify a manifest-committed canonical Zarr package."""
    manifest = artifact.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("format") != "zarr-v2":
        raise RuntimeError("Canonical artifact is not a Zarr v2 result package.")
    destination = output / "canonical-result.zarr"
    destination.mkdir(parents=True, exist_ok=True)
    for part in manifest.get("partitions", []):
        relative = Path(part["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise RuntimeError("Canonical manifest contains an unsafe part path.")
        local_path = destination / relative
        local_path.parent.mkdir(parents=True, exist_ok=True)
        bucket, key = parse_uri(part["uri"])
        download_object(bucket=bucket, key=key, local_path=str(local_path))
        if _sha256(local_path) != part["checksum"]:
            raise RuntimeError(f"Canonical Zarr checksum mismatch: {relative}.")
    return destination


@task
def _render_batch(
    specification: dict[str, Any],
    batch: dict[str, int],
    output_path: str,
) -> dict[str, Any]:
    """Render one bounded destination tile batch."""
    return asdict(render_windowed_pmtiles_batch(specification, batch, output_path))


def _create_pmtiles(canonical: Path, destination: Path, resolution: int) -> Path:
    """Render the canonical decision surface and deterministically pack PMTiles."""
    specification, batches = prepare_windowed_pmtiles(
        canonical,
        min_zoom=0,
        max_zoom=resolution_to_max_zoom(resolution),
        metatile_size=int(os.getenv("PMTILES_METATILE_SIZE", "3")),
        maximum_source_window=int(
            os.getenv("PMTILES_MAXIMUM_SOURCE_WINDOW", "2048")
        ),
        png_compress_level=int(os.getenv("PMTILES_PNG_COMPRESS_LEVEL", "3")),
    )
    run_directory = destination.parent / f".{destination.name}.runs"
    run_paths: list[Path] = []
    wave_size = int(os.getenv("SPATIAL_TILE_SUBMISSION_WAVE", "32"))
    if wave_size <= 0:
        raise ValueError("SPATIAL_TILE_SUBMISSION_WAVE must be positive.")
    serialized = asdict(specification)
    for start in range(0, len(batches), wave_size):
        wave: list[tuple[Any, Path]] = []
        for index, batch in enumerate(batches[start : start + wave_size], start=start):
            run_path = run_directory / f"batch-{index:08d}.tiles"
            wave.append(
                (
                    _render_batch.submit(serialized, asdict(batch), str(run_path)),
                    run_path,
                )
            )
        for future, run_path in wave:
            future.result()
            run_paths.append(run_path)
    return finalize_windowed_pmtiles(
        specification,
        run_paths,
        destination,
        maximum_merge_fan_in=int(os.getenv("PMTILES_MERGE_FAN_IN", "64")),
    )


def _upload_pmtiles(task_run_id: str, path: Path, surface: str) -> dict[str, Any]:
    """Upload one decision tileset with immutable content identity."""
    config = get_object_store_config()
    checksum = _sha256(path)
    key = build_object_key(
        f"runs/{task_run_id}/pmtiles/{checksum}/result.pmtiles"
    )
    uploaded = put_object(
        local_path=str(path),
        bucket=config.bucket,
        key=key,
        content_type="application/vnd.pmtiles",
        metadata={
            "task_run_id": task_run_id,
            "prefect_flow_run_id": str(flow_run.id),
            "sha256": checksum,
            "surface": surface,
        },
    )
    size_bytes = path.stat().st_size
    return {
        "status": "ready",
        "uri": uploaded["uri"],
        "content_type": "application/vnd.pmtiles",
        "checksum": checksum,
        "size_bytes": size_bytes,
        "manifest": {
            "schema_version": 1,
            "partitions": [
                {
                    "uri": uploaded["uri"],
                    "checksum": checksum,
                    "size_bytes": size_bytes,
                }
            ],
        },
        "lineage": {
            "artifact_class": "presentation",
            "surface": surface,
            "tile_encoder": "pmtiles_png_metatile_v3",
        },
    }


@flow(
    name="task_tile",
    task_runner=DaskTaskRunner(
        cluster_class=LocalCluster,
        cluster_kwargs={
            "n_workers": int(os.getenv("SPATIAL_DASK_WORKERS", "2")),
            "threads_per_worker": 1,
            "memory_limit": os.getenv("SPATIAL_DASK_WORKER_MEMORY", "1500MB"),
        },
    ),
)
def task_tile(task_run_id: str) -> None:
    """Publish the reference decision surface from one canonical result."""
    logger = get_run_logger()
    run = internal_api_request("GET", f"/internal/run/{task_run_id}")
    canonical = next(
        (
            artifact
            for artifact in run["artifacts"]
            if artifact["type"] == "canonical_result"
        ),
        None,
    )
    if not canonical or canonical["status"] != "ready" or not canonical["uri"]:
        raise ValueError("A ready canonical result is required before publication.")
    output = Path("/data/outputs") / "runs" / task_run_id / str(flow_run.id)
    output.mkdir(parents=True, exist_ok=True)
    try:
        canonical_path = _download_canonical_zarr(canonical, output)
        surface = str(
            zarr.open_group(str(canonical_path), mode="r").attrs.get(
                "surface", "decision"
            )
        )
        pmtiles_path = _create_pmtiles(
            canonical_path,
            output / f"{surface}.pmtiles",
            int(run["planning_unit_definition"]["planning_unit_resolution"]),
        )
        metadata = _upload_pmtiles(task_run_id, pmtiles_path, surface)
        internal_api_request(
            "POST",
            f"/internal/run/{task_run_id}/artifact/pmtiles",
            metadata,
        )
        internal_api_request(
            "POST",
            f"/internal/run/{task_run_id}/status",
            {"status": "completed", "stage": None},
        )
        logger.info("Reference solution publication completed: %s", task_run_id)
    except Exception as error:
        internal_api_request(
            "POST",
            f"/internal/run/{task_run_id}/artifact/pmtiles",
            {
                "status": "failed",
                "failure_code": "publication_failed",
                "failure_message": str(error),
            },
        )
        internal_api_request(
            "POST",
            f"/internal/run/{task_run_id}/status",
            {
                "status": "failed",
                "failure_code": "publication_failed",
                "failure_message": str(error),
            },
        )
        raise
