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

    future = execute_optimization.submit(conditions)

    future.wait()

    return
