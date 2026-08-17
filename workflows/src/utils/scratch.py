from __future__ import annotations

import os
import shutil
from pathlib import Path


DEFAULT_WORKFLOW_SCRATCH_ROOT = "/tmp/conservation-workflows"


def workflow_scratch_root() -> Path:
    """Return the writable root for ephemeral workflow intermediates."""
    return Path(os.getenv("WORKFLOW_SCRATCH_ROOT", DEFAULT_WORKFLOW_SCRATCH_ROOT))


def task_run_scratch_directory(task_run_id: str, flow_run_id: str | None) -> Path:
    """Return the per-flow-run scratch directory for one task run."""
    run_directory = flow_run_id or "local"
    return workflow_scratch_root() / "runs" / task_run_id / run_directory


def cleanup_scratch_directory(path: Path) -> None:
    """Remove one workflow scratch directory unless debugging keeps it."""
    if os.getenv("WORKFLOW_KEEP_SCRATCH", "").lower() in {"1", "true", "yes"}:
        return
    shutil.rmtree(path, ignore_errors=True)
