import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import yaml
from prefect.client.schemas.objects import StateType
from prefect.events.schemas.automations import Posture

from src.utils.flow_run_recovery import (
    AUTOMATION_NAME,
    FLOW_NAMES,
    build_flow_run_recovery_automation,
    ensure_flow_run_recovery,
)


class FlowRunRecoveryTest(unittest.TestCase):
    def test_recovery_is_scoped_to_registered_conservation_flows(self) -> None:
        with (Path(__file__).parents[1] / "prefect.yaml").open() as source:
            deployments = yaml.safe_load(source)["deployments"]
        self.assertEqual(
            {deployment["entrypoint"].split(":")[-1] for deployment in deployments},
            set(FLOW_NAMES),
        )
        trigger = build_flow_run_recovery_automation().trigger
        self.assertTrue(
            trigger.match_related.matches(
                {
                    "prefect.resource.role": "flow",
                    "prefect.resource.name": "task_export",
                }
            )
        )
        self.assertFalse(
            trigger.match_related.matches(
                {
                    "prefect.resource.role": "flow",
                    "prefect.resource.name": "unrelated_flow",
                }
            )
        )

    def test_missing_heartbeats_crash_each_run_without_a_runtime_deadline(self) -> None:
        automation = build_flow_run_recovery_automation()
        trigger = automation.trigger
        self.assertEqual(Posture.Proactive, trigger.posture)
        self.assertEqual({"prefect.resource.id"}, trigger.for_each)
        self.assertEqual({"prefect.flow-run.heartbeat"}, trigger.after)
        self.assertEqual(180, trigger.within.total_seconds())
        self.assertEqual(1, trigger.threshold)
        for event in [
            "heartbeat",
            "Completed",
            "Failed",
            "Cancelled",
            "Crashed",
            "Paused",
        ]:
            self.assertIn(f"prefect.flow-run.{event}", trigger.expect)
        self.assertEqual(StateType.CRASHED, automation.actions[0].state)


class FlowRunRecoveryRegistrationTest(unittest.IsolatedAsyncioTestCase):
    async def test_repeated_setup_updates_the_same_automation(self) -> None:
        client = AsyncMock()
        automation_id = uuid4()
        client.read_automations_by_name.side_effect = [
            [],
            [SimpleNamespace(id=automation_id)],
        ]
        with patch("src.utils.flow_run_recovery.get_client") as get_client:
            get_client.return_value.__aenter__.return_value = client
            await ensure_flow_run_recovery()
            await ensure_flow_run_recovery()
        client.create_automation.assert_awaited_once()
        client.update_automation.assert_awaited_once()
        self.assertEqual(automation_id, client.update_automation.call_args.args[0])
        self.assertEqual(
            AUTOMATION_NAME, client.create_automation.call_args.args[0].name
        )
        self.assertTrue(client.update_automation.call_args.args[1].enabled)

    async def test_api_failure_stops_setup_instead_of_creating_duplicates(self) -> None:
        client = AsyncMock()
        client.read_automations_by_name.side_effect = RuntimeError("API unavailable")
        with patch("src.utils.flow_run_recovery.get_client") as get_client:
            get_client.return_value.__aenter__.return_value = client
            with self.assertRaisesRegex(RuntimeError, "API unavailable"):
                await ensure_flow_run_recovery()
        client.create_automation.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
