import os
from typing import Optional

import requests
from dask.distributed import LocalCluster
from prefect import (
    flow,
    get_run_logger,
)
from prefect_dask.task_runners import DaskTaskRunner

from ..tasks.strict_optimization import (
    OptimizationParameters,
    execute_optimization,
)


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
        future = execute_optimization.submit(conditions)
        future.wait()
        update_task_status(task_id, "completed")
    except Exception as error:
        update_task_status(task_id, "failed", str(error))
        raise

    return


def update_task_status(task_id: str, status: str, message: Optional[str] = None) -> None:
    api_url = os.getenv("CONSERVATION_API_URL")
    api_key = os.getenv("INTERNAL_API_KEY")

    if not api_url:
        raise ValueError("CONSERVATION_API_URL is not configured for task status updates.")

    if not api_key:
        raise ValueError("INTERNAL_API_KEY is not configured for task status updates.")

    url = f"{api_url.rstrip('/')}/internal/task/{task_id}/status"
    payload = {"status": status, "message": message}

    response = requests.post(
        url,
        json=payload,
        headers={"x-internal-api-key": api_key},
        timeout=10,
    )

    response.raise_for_status()
