from __future__ import annotations

import os

from prefect import flow
from prefect_dask.task_runners import DaskTaskRunner

from .optimization_execution import (
    CompiledRunPreparation,
    compile_optimization_run,
    execute_priority_ranking_run,
)


@flow(
    name="compile_task_run_priority_ranking",
    task_runner=DaskTaskRunner(
        cluster_kwargs={
            "n_workers": int(os.getenv("SPATIAL_DASK_WORKERS", "1")),
            "threads_per_worker": int(os.getenv("SPATIAL_DASK_THREADS", "1")),
            "memory_limit": os.getenv("SPATIAL_DASK_WORKER_MEMORY", "4GB"),
        }
    ),
)
def compile_task_run_priority_ranking(
    task_run_id: str,
    run: dict,
    output_directory: str,
) -> CompiledRunPreparation:
    """Compile one priority-ranking LP artifact inside a short-lived Dask flow."""
    return compile_optimization_run(task_run_id, run, output_directory)


@flow(name="task_run_priority_ranking")
def task_run_priority_ranking(task_run_id: str) -> None:
    """Compile, solve, reconstruct, and publish one priority-ranking analysis."""
    execute_priority_ranking_run(
        task_run_id,
        compile_run=compile_task_run_priority_ranking,
    )
