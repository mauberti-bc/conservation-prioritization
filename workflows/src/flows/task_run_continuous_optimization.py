import os

from dask.distributed import LocalCluster
from prefect import flow
from prefect_dask.task_runners import DaskTaskRunner

from .optimization_execution import (
    CompiledRunPreparation,
    compile_optimization_run,
    execute_optimization_run,
)


@flow(
    name="compile_task_run_continuous_optimization",
    task_runner=DaskTaskRunner(
        cluster_class=LocalCluster,
        cluster_kwargs={
            "n_workers": int(os.getenv("SPATIAL_DASK_WORKERS", "1")),
            "threads_per_worker": 1,
            "memory_limit": os.getenv("SPATIAL_DASK_WORKER_MEMORY", "4GB"),
        },
    ),
)
def compile_task_run_continuous_optimization(
    task_run_id: str,
    run: dict[str, object],
    output_directory: str,
) -> CompiledRunPreparation:
    """Compile one continuous run in a child flow with a bounded Dask cluster."""
    return compile_optimization_run(task_run_id, run, output_directory)


@flow(name="task_run_continuous_optimization")
def task_run_continuous_optimization(task_run_id: str) -> None:
    """Compile, solve, reconstruct, and publish one fractional allocation problem."""
    execute_optimization_run(
        task_run_id,
        expected_task_type="continuous_optimization",
        expected_execution_method="compiled_continuous_optimization",
        decision_domain="continuous",
        compile_run=compile_task_run_continuous_optimization,
    )
