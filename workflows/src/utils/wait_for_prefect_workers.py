"""Verify live worker heartbeats after deployment registration completes."""

import asyncio
from datetime import datetime, timezone
import math
import sys

from prefect.client.orchestration import get_client
from prefect.client.schemas.objects import WorkerStatus


async def wait_for_prefect_workers(
    pool_names: list[str], timeout_seconds: float = 180
) -> None:
    """Require a new online-worker heartbeat for each configured pool.

    Args:
        pool_names: Work pools expected to have a running process worker.
        timeout_seconds: Maximum duration for all pools to report fresh heartbeats.

    Returns:
        None once every pool has demonstrated a live worker.

    Raises:
        ValueError: No pools or an invalid timeout were supplied.
        TimeoutError: At least one pool has no fresh online-worker heartbeat.
        Exception: Prefect API errors propagate to the registration Job.
    """
    if not pool_names or not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ValueError(
            "Worker verification requires pools and a positive finite timeout."
        )
    started_at = datetime.now(timezone.utc)
    pending = set(pool_names)
    try:
        async with asyncio.timeout(timeout_seconds), get_client() as client:
            while pending:
                for pool_name in sorted(pending):
                    workers = await client.read_workers_for_work_pool(pool_name)
                    if any(
                        worker.status == WorkerStatus.ONLINE
                        and worker.last_heartbeat_time is not None
                        and worker.last_heartbeat_time >= started_at
                        for worker in workers
                    ):
                        pending.remove(pool_name)
                        print(
                            f"Verified a fresh worker heartbeat for {pool_name}.",
                            flush=True,
                        )
                if pending:
                    print(
                        f"Waiting for worker heartbeats: {', '.join(sorted(pending))}",
                        flush=True,
                    )
                    await asyncio.sleep(5)
    except TimeoutError as error:
        raise TimeoutError(
            f"No fresh worker heartbeat before the deadline: {', '.join(sorted(pending))}."
        ) from error


if __name__ == "__main__":
    asyncio.run(wait_for_prefect_workers(sys.argv[1:]))
