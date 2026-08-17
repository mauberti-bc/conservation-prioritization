from __future__ import annotations

import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Sequence

from prefect import flow

from ..optimization.artifact import load_compiled_artifact
from ..optimization.irreplaceability import analyze_irreplaceability
from ..optimization.model import SolveConfiguration, SolverResult
from ..utils.task_run_concurrency import acquire_task_run_slot


@flow(name="irreplaceability")
def irreplaceability(
    compiled_artifact_directory: str,
    reference_result: SolverResult,
    output_path: str,
    requested_planning_unit_ids: Sequence[int] | None = None,
    solve_configuration: SolveConfiguration | None = None,
) -> str:
    """Run a bounded exclusion analysis against one compiled artifact.

    Compilation is deliberately outside this flow. Only the resident HiGHS
    exclusion solves occupy the scarce global solver slot.
    """
    maximum_scenarios = int(os.getenv("MAX_IRREPLACEABILITY_SCENARIOS", "100"))
    artifact = load_compiled_artifact(compiled_artifact_directory)
    with acquire_task_run_slot():
        result = analyze_irreplaceability(
            artifact.model,
            reference_result,
            candidate_planning_unit_ids=artifact.candidate_planning_unit_ids,
            requested_planning_unit_ids=requested_planning_unit_ids,
            configuration=solve_configuration,
            maximum_scenarios=maximum_scenarios,
        )
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(asdict(result), sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    return str(destination)
