"""Require live workers rather than stale registry entries before deployment succeeds."""

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from prefect.client.schemas.objects import WorkerStatus

from src.utils.wait_for_prefect_workers import wait_for_prefect_workers


class WorkerReadinessTests(unittest.IsolatedAsyncioTestCase):
    async def test_stale_and_offline_workers_do_not_satisfy_readiness(self):
        """Only a heartbeat produced after the check begins proves worker activity."""
        client = MagicMock()
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)
        now = datetime.now(timezone.utc)
        client.read_workers_for_work_pool = AsyncMock(
            side_effect=[
                [
                    SimpleNamespace(
                        status=WorkerStatus.ONLINE,
                        last_heartbeat_time=now - timedelta(minutes=5),
                    )
                ],
                [
                    SimpleNamespace(
                        status=WorkerStatus.OFFLINE,
                        last_heartbeat_time=now + timedelta(seconds=5),
                    )
                ],
                [
                    SimpleNamespace(
                        status=WorkerStatus.ONLINE,
                        last_heartbeat_time=now + timedelta(seconds=5),
                    )
                ],
            ]
        )
        with (
            patch("src.utils.wait_for_prefect_workers.get_client", return_value=client),
            patch(
                "src.utils.wait_for_prefect_workers.asyncio.sleep",
                new_callable=AsyncMock,
            ) as sleep,
        ):
            await wait_for_prefect_workers(["sparse-solver"])
        self.assertEqual(client.read_workers_for_work_pool.await_count, 3)
        self.assertEqual(sleep.await_count, 2)

    async def test_missing_worker_fails_with_pool_name(self):
        """A deployment cannot succeed just because its worker pod is running."""
        client = MagicMock()
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)
        client.read_workers_for_work_pool = AsyncMock(return_value=[])
        with patch(
            "src.utils.wait_for_prefect_workers.get_client", return_value=client
        ):
            with self.assertRaisesRegex(TimeoutError, "sparse-solver"):
                await wait_for_prefect_workers(["sparse-solver"], timeout_seconds=0.01)
