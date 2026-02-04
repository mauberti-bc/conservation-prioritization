import os
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import requests
from affine import Affine
from prefect import flow, get_run_logger
from prefect.runtime import flow_run

from ..tasks.strict_optimization import (
    create_pmtiles_archive,
    resolution_to_max_zoom,
)
from ..utils.object_store import (
    build_object_key,
    download_object,
    get_object_store_config,
    parse_uri,
    put_object,
)


def _get_internal_api_config() -> tuple[str, str]:
    api_url = os.getenv("CONSERVATION_API_URL")
    api_key = os.getenv("INTERNAL_API_KEY")

    if not api_url:
        raise ValueError("CONSERVATION_API_URL is not configured for task tile updates.")

    if not api_key:
        raise ValueError("INTERNAL_API_KEY is not configured for task tile updates.")

    return api_url.rstrip("/"), api_key


def _update_task_tile_status(
    task_tile_id: str,
    status: str,
    pmtiles_uri: Optional[str] = None,
    content_type: Optional[str] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    api_url, api_key = _get_internal_api_config()
    url = f"{api_url}/tile/{task_tile_id}/status"

    payload: Dict[str, Any] = {"status": status}
    if pmtiles_uri is not None:
        payload["pmtiles_uri"] = pmtiles_uri
    if content_type is not None:
        payload["content_type"] = content_type
    if error_code is not None:
        payload["error_code"] = error_code
    if error_message is not None:
        payload["error_message"] = error_message

    response = requests.post(url, json=payload, headers={"x-internal-api-key": api_key}, timeout=10)
    response.raise_for_status()


def _load_solution_artifacts(artifact_path: Path) -> tuple[np.ndarray, Affine, str, int]:
    if not artifact_path.exists():
        raise FileNotFoundError(f"Solution artifact not found at {artifact_path}")

    data = np.load(artifact_path, allow_pickle=True)
    solution = data["solution"]
    transform_values = data["transform"]
    crs = str(data["crs"])
    resolution = int(data["resolution"])

    transform = Affine.from_gdal(*transform_values)

    return solution, transform, crs, resolution


def _get_task_output_uri(task_id: str) -> str:
    api_url, api_key = _get_internal_api_config()
    url = f"{api_url}/internal/task/{task_id}"
    response = requests.get(url, headers={"x-internal-api-key": api_key}, timeout=10)
    response.raise_for_status()

    data = response.json()
    output_uri = data.get("output_uri")

    if not output_uri:
        raise ValueError("Task output_uri is missing; strict optimization has not completed.")

    return output_uri


def _download_solution_artifact(task_id: str, output_uri: str) -> Path:
    bucket, key = parse_uri(output_uri)
    output_dir = Path("/data/outputs") / task_id
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / "solution.npz"

    download_object(bucket=bucket, key=key, local_path=str(artifact_path))

    if not artifact_path.exists() or artifact_path.stat().st_size == 0:
        raise FileNotFoundError(f"Downloaded artifact is missing or empty: {artifact_path}")

    return artifact_path


@flow(name="task_tile")
def tile_task(task_id: str, task_tile_id: str):
    """
    Dedicated tiling flow that generates PMTiles and persists task tile status.
    """
    logger = get_run_logger()

    try:
        _update_task_tile_status(task_tile_id, "STARTED")

        output_uri = _get_task_output_uri(task_id)
        artifact_path = _download_solution_artifact(task_id, output_uri)
        solution, transform, crs, resolution = _load_solution_artifacts(artifact_path)

        output_dir = Path("/data/outputs") / task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        pmtiles_path = output_dir / "solution.pmtiles"

        logger.info("Creating PMTiles archive...")
        max_zoom = resolution_to_max_zoom(resolution)
        future = create_pmtiles_archive.submit(
            array=solution,
            transform=transform,
            out_path=str(pmtiles_path),
            crs=crs,
            max_zoom=max_zoom,
        )
        future.wait()

        if not pmtiles_path.exists() or pmtiles_path.stat().st_size == 0:
            raise RuntimeError("PMTiles archive was not created or is empty.")

        logger.info("Uploading PMTiles to object storage...")
        config = get_object_store_config()
        run_id = str(flow_run.id)
        object_key = build_object_key(
            config.prefix,
            f"tasks/{task_id}/tile/{run_id}/tiles.pmtiles",
        )
        put_response = put_object(
            local_path=str(pmtiles_path),
            bucket=config.bucket,
            key=object_key,
            content_type="application/vnd.pmtiles",
            metadata={
                "task_id": task_id,
                "prefect_flow_run_id": run_id,
            },
        )

        pmtiles_uri = put_response.get("uri")
        if not pmtiles_uri:
            raise RuntimeError("Object storage did not return a PMTiles URI.")

        _update_task_tile_status(
            task_tile_id,
            "COMPLETED",
            pmtiles_uri=pmtiles_uri,
            content_type="application/vnd.pmtiles",
        )

        logger.info("Tiling completed successfully")
    except Exception as error:
        logger.error(f"Tiling failed: {error}")
        _update_task_tile_status(
            task_tile_id,
            "FAILED",
            error_code="tiling_failed",
            error_message=str(error),
        )
        raise
