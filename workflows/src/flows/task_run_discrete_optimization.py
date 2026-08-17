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
    name="compile_task_run_discrete_optimization",
    task_runner=DaskTaskRunner(
        cluster_class=LocalCluster,
        cluster_kwargs={
            "n_workers": int(os.getenv("SPATIAL_DASK_WORKERS", "1")),
            "threads_per_worker": 1,
            "memory_limit": os.getenv("SPATIAL_DASK_WORKER_MEMORY", "4GB"),
        },
    ),
)
def compile_task_run_discrete_optimization(
    task_run_id: str,
    run: dict[str, object],
    output_directory: str,
) -> CompiledRunPreparation:
    """Compile one discrete run in a child flow whose Dask cluster closes on return."""
    return compile_optimization_run(task_run_id, run, output_directory)


@flow(name="task_run_discrete_optimization")
def task_run_discrete_optimization(task_run_id: str) -> None:
    """Compile, solve, reconstruct, and publish one binary conservation problem."""
    execute_optimization_run(
        task_run_id,
        expected_task_type="discrete_optimization",
        expected_execution_method="compiled_discrete_optimization",
        decision_domain="discrete",
        compile_run=compile_task_run_discrete_optimization,
    )
