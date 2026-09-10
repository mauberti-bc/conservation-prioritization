from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import zarr
from prefect import flow, get_run_logger
from prefect.runtime import flow_run

from ..publication.geotiff_export import (
    canonical_surface,
    export_resource_admission,
    upload_geotiff_part,
    write_geotiff_parts,
)
from ..utils.internal_api import internal_api_request
from ..utils.object_store import download_object, parse_uri
from ..utils.scratch import cleanup_scratch_directory, workflow_scratch_root


def _sha256(path: Path) -> str:
    """Return the SHA-256 checksum of one canonical result part."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_canonical_zarr(artifact: dict[str, Any], output: Path) -> Path:
    """Download and verify a manifest-committed canonical Zarr package."""
    manifest = artifact.get("manifest")
    if not isinstance(manifest, dict):
        raise RuntimeError("Canonical artifact manifest is missing.")
    partitions = manifest.get("partitions")
    if not isinstance(partitions, list) or not partitions:
        raise RuntimeError("Canonical artifact manifest has no partitions.")
    destination = output / "canonical-result.zarr"
    destination.mkdir(parents=True, exist_ok=True)
    for part in partitions:
        if not isinstance(part, dict):
            raise RuntimeError("Canonical manifest contains an invalid partition.")
        required = ("path", "uri", "checksum")
        if not all(isinstance(part.get(key), str) for key in required):
            raise RuntimeError("Canonical manifest partition is incomplete.")
        relative = Path(part["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise RuntimeError("Canonical manifest contains an unsafe part path.")
        local_path = destination / relative
        local_path.parent.mkdir(parents=True, exist_ok=True)
        bucket, key = parse_uri(part["uri"])
        download_object(bucket=bucket, key=key, local_path=str(local_path))
        if _sha256(local_path) != part["checksum"]:
            raise RuntimeError(f"Canonical Zarr checksum mismatch: {relative}.")
    zarr.open_group(str(destination), mode="r")
    return destination


def _export_scratch_directory(task_export_id: str, flow_run_id: str | None) -> Path:
    """Return attempt-local scratch for one export flow run."""
    run_directory = flow_run_id or "local"
    return workflow_scratch_root() / "exports" / task_export_id / run_directory


@flow(name="task_export")
def task_export(task_export_id: str, attempt: int) -> None:
    """Generate durable GeoTIFF files from one canonical task-run result."""
    logger = get_run_logger()
    output = _export_scratch_directory(task_export_id, str(flow_run.id))
    output.mkdir(parents=True, exist_ok=True)
    try:
        context = internal_api_request("GET", f"/internal/export/{task_export_id}")
        task_export_context = context["export"]
        run = context["run"]
        canonical = next(
            (
                artifact
                for artifact in run["artifacts"]
                if artifact["artifact_id"] == task_export_context["source_artifact_id"]
            ),
            None,
        )
        if not canonical or canonical["status"] != "ready":
            raise ValueError("A ready canonical result is required before export.")

        canonical_path = _download_canonical_zarr(canonical, output)
        admission = export_resource_admission(canonical_path)
        internal_api_request(
            "POST",
            f"/internal/export/{task_export_id}/status",
            {
                "attempt": attempt,
                "status": "running",
                "resource_admission": admission,
                "progress": {"completed_files": 0},
            },
        )

        surface = canonical_surface(canonical_path)
        parts = write_geotiff_parts(
            export_id=task_export_id,
            canonical_path=canonical_path,
            output_directory=output / "geotiff-parts",
        )
        for part in parts:
            metadata = upload_geotiff_part(
                export_id=task_export_id,
                task_run_id=run["task_run_id"],
                part=part,
                surface=surface,
            )
            internal_api_request(
                "POST",
                f"/internal/export/{task_export_id}/file",
                {"attempt": attempt, **metadata},
            )
            part.path.unlink(missing_ok=True)
            internal_api_request(
                "POST",
                f"/internal/export/{task_export_id}/status",
                {
                    "attempt": attempt,
                    "status": "running",
                    "progress": {
                        "completed_files": part.part_index + 1,
                        "total_files": len(parts),
                    },
                },
            )

        internal_api_request(
            "POST",
            f"/internal/export/{task_export_id}/status",
            {
                "attempt": attempt,
                "status": "ready",
                "progress": {
                    "completed_files": len(parts),
                    "total_files": len(parts),
                },
            },
        )
        logger.info("GeoTIFF export completed: %s", task_export_id)
    except Exception as error:
        internal_api_request(
            "POST",
            f"/internal/export/{task_export_id}/status",
            {
                "attempt": attempt,
                "status": "failed",
                "failure_code": "export_failed",
                "failure_message": str(error),
            },
        )
        raise
    finally:
        cleanup_scratch_directory(output)
