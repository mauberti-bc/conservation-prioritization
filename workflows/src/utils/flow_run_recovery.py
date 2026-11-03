"""Register server-side recovery for conservation flows whose process has died."""

import asyncio
from datetime import timedelta

from prefect.client.orchestration import get_client
from prefect.client.schemas.objects import StateType
from prefect.events.actions import ChangeFlowRunState
from prefect.events.schemas.automations import AutomationCore, EventTrigger, Posture
from prefect.events.schemas.events import ResourceSpecification


AUTOMATION_NAME = "conservation-flow-run-heartbeat-recovery"
HEARTBEAT_TIMEOUT_SECONDS = 180
FLOW_NAMES = [
    "task_run_discrete_optimization",
    "task_run_continuous_optimization",
    "task_run_priority_ranking",
    "task_tile",
    "task_export",
]


def build_flow_run_recovery_automation() -> AutomationCore:
    """Build a per-run missing-heartbeat trigger limited to conservation flows."""
    return AutomationCore(
        name=AUTOMATION_NAME,
        description="Release work-pool capacity when a conservation runner stops.",
        enabled=True,
        trigger=EventTrigger(
            after={"prefect.flow-run.heartbeat"},
            expect={
                "prefect.flow-run.heartbeat",
                "prefect.flow-run.Completed",
                "prefect.flow-run.Failed",
                "prefect.flow-run.Cancelled",
                "prefect.flow-run.Crashed",
                "prefect.flow-run.Paused",
            },
            match=ResourceSpecification({"prefect.resource.id": "prefect.flow-run.*"}),
            match_related=ResourceSpecification(
                {
                    "prefect.resource.role": "flow",
                    "prefect.resource.name": FLOW_NAMES,
                }
            ),
            for_each={"prefect.resource.id"},
            posture=Posture.Proactive,
            threshold=1,
            within=timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS),
        ),
        actions=[
            ChangeFlowRunState(
                state=StateType.CRASHED,
                message=(
                    "No flow-run heartbeat received for 180 seconds; "
                    "runner may have terminated."
                ),
            )
        ],
    )


async def ensure_flow_run_recovery() -> None:
    """Create or update the recovery automation; propagate registration failures."""
    automation = build_flow_run_recovery_automation()
    async with get_client() as client:
        existing = await client.read_automations_by_name(AUTOMATION_NAME)
        if existing:
            for registered in existing:
                await client.update_automation(registered.id, automation)
        else:
            await client.create_automation(automation)


if __name__ == "__main__":
    asyncio.run(ensure_flow_run_recovery())
