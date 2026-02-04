import os
import time
from typing import Optional

import requests
from dask.distributed import LocalCluster
from prefect import (
    flow,
    get_run_logger,
)
from prefect.runtime import flow_run
from prefect_dask.task_runners import DaskTaskRunner

from ..tasks.strict_optimization import (
    OptimizationParameters,
    execute_optimization,
)
from ..utils.object_store import build_object_key, get_object_store_config, put_object


@flow(
    name="strict_optimization",
    task_runner=DaskTaskRunner(  # type: ignore
        cluster_class=LocalCluster,
        cluster_kwargs={
            "n_workers": 4,
            "threads_per_worker": 1,
            "memory_limit": "2GB",
        },
    ),
)
def strict_optimization(
    task_id: str,
    conditions: OptimizationParameters,
):
    """
    Main optimization flow entrypoint that delegates all work to a single task
    running on the Dask cluster.

    Access the Dask dashboard at http://localhost:8787
    """
    logger = get_run_logger()
    logger.info("Starting strict optimization flow")
    logger.info("Dask dashboard available at http://localhost:8787")

    update_task_status(task_id, "running")

    try:
        future = execute_optimization.submit(task_id, conditions)
        artifact_path = future.result()

        if not artifact_path:
            raise RuntimeError("Optimization produced no output artifact.")

        config = get_object_store_config()
        run_id = str(flow_run.id)
        object_key = build_object_key(
            config.prefix,
            f"tasks/{task_id}/strict_optimization/{run_id}/output.npz",
        )

        put_response = put_object(
            local_path=artifact_path,
            bucket=config.bucket,
            key=object_key,
            content_type="application/octet-stream",
            metadata={
                "task_id": task_id,
                "prefect_flow_run_id": run_id,
            },
        )

        update_task_status(
            task_id,
            "completed",
            output_uri=put_response["uri"],
        )
    except Exception as error:
        update_task_status(task_id, "failed", str(error))
        raise

    return


def update_task_status(
    task_id: str,
    status: str,
    message: Optional[str] = None,
    output_uri: Optional[str] = None,
) -> None:
    api_url = os.getenv("CONSERVATION_API_URL")
    api_key = os.getenv("INTERNAL_API_KEY")

    if not api_url:
        raise ValueError("CONSERVATION_API_URL is not configured for task status updates.")

    if not api_key:
        raise ValueError("INTERNAL_API_KEY is not configured for task status updates.")

    url = f"{api_url.rstrip('/')}/internal/task/{task_id}/status"
    payload = {"status": status, "message": message, "output_uri": output_uri}

    for attempt in range(1, 6):
        response = requests.post(
            url,
            json=payload,
            headers={"x-internal-api-key": api_key},
            timeout=10,
        )

        if response.ok:
            return

        if attempt == 5:
            response.raise_for_status()

        time.sleep(0.5 * attempt)
