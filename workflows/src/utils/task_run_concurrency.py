from contextlib import contextmanager
from typing import Iterator

from prefect.concurrency.sync import concurrency


TASK_RUN_CONCURRENCY_LIMIT = "conservation-task-runs"
# Prefect Server rejects concurrency leases shorter than 60 seconds.
TASK_RUN_LEASE_DURATION_SECONDS = 60


@contextmanager
def acquire_task_run_slot() -> Iterator[None]:
    """Hold the shared slot while allowing prompt recovery after process death."""
    with concurrency(
        TASK_RUN_CONCURRENCY_LIMIT,
        occupy=1,
        lease_duration=TASK_RUN_LEASE_DURATION_SECONDS,
        strict=True,
    ):
        yield
