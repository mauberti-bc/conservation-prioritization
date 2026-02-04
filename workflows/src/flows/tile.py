import os
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import requests
from affine import Affine
from prefect import flow, get_run_logger

from ..tasks.strict_optimization import (
    create_pmtiles_archive,
    resolution_to_max_zoom,
    upload_file_to_object_store,
)


def _get_internal_api_config() -> tuple[str, str]:
    api_url = os.getenv("CONSERVATION_API_URL")
    api_key = os.getenv("INTERNAL_API_KEY")

    if not api_url:
        raise ValueError("CONSERVATION_API_URL is not configured for task tile updates.")

    if not api_key:
        raise ValueError("INTERNAL_API_KEY is not configured for task tile updates.")

    return api_url.rstrip("/"), api_key


def _create_task_tile(task_id: str) -> str:
    api_url, api_key = _get_internal_api_config()
    url = f"{api_url}/internal/task/{task_id}/tile"

    response = requests.post(url, headers={"x-internal-api-key": api_key}, timeout=10)
    response.raise_for_status()
    data: Dict[str, Any] = response.json()
    return str(data["task_tile_id"])


def _update_task_tile_status(
    task_tile_id: str,
    status: str,
    uri: Optional[str] = None,
    content_type: Optional[str] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    api_url, api_key = _get_internal_api_config()
    url = f"{api_url}/internal/task-tile/{task_tile_id}/status"

    payload: Dict[str, Any] = {"status": status}
    if uri is not None:
        payload["uri"] = uri
    if content_type is not None:
        payload["content_type"] = content_type
    if error_code is not None:
        payload["error_code"] = error_code
    if error_message is not None:
        payload["error_message"] = error_message

    response = requests.post(url, json=payload, headers={"x-internal-api-key": api_key}, timeout=10)
    response.raise_for_status()


def _load_solution_artifacts(task_id: str) -> tuple[np.ndarray, Affine, str, int]:
    artifact_path = Path("/data/outputs") / task_id / "solution.npz"

    if not artifact_path.exists():
        raise FileNotFoundError(f"Solution artifact not found at {artifact_path}")

    data = np.load(artifact_path, allow_pickle=True)
    solution = data["solution"]
    transform_values = data["transform"]
    crs = str(data["crs"])
    resolution = int(data["resolution"])

    transform = Affine.from_gdal(*transform_values)

    return solution, transform, crs, resolution


@flow(name="task_tile")
def tile_task(task_id: str):
    """
    Dedicated tiling flow that generates PMTiles and persists task tile status.
    """
    logger = get_run_logger()

    task_tile_id: Optional[str] = None

    try:
        task_tile_id = _create_task_tile(task_id)
        _update_task_tile_status(task_tile_id, "STARTED")

        solution, transform, crs, resolution = _load_solution_artifacts(task_id)

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

        logger.info("Uploading PMTiles to object storage...")
        uri = upload_file_to_object_store(
            local_path=str(pmtiles_path),
            task_id=task_id,
            content_type="application/vnd.pmtiles",
        )

        _update_task_tile_status(task_tile_id, "COMPLETED", uri=uri, content_type="application/vnd.pmtiles")

        logger.info("Tiling completed successfully")
    except Exception as error:
        logger.error(f"Tiling failed: {error}")
        if task_tile_id:
            _update_task_tile_status(
                task_tile_id,
                "FAILED",
                error_code="tiling_failed",
                error_message=str(error),
            )
        raise
