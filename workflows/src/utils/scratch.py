from __future__ import annotations

import os
import shutil
from pathlib import Path

from .env import parse_int_setting


DEFAULT_WORKFLOW_SCRATCH_ROOT = "/workflow-scratch"
DEFAULT_WORKFLOW_SCRATCH_LIMIT_BYTES = 512 * 1024**2


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


def workflow_scratch_limit_bytes() -> int:
    """Return the configured durable workflow scratch capacity."""
    return parse_int_setting(
        os.getenv(
            "WORKFLOW_SCRATCH_LIMIT_BYTES",
            str(DEFAULT_WORKFLOW_SCRATCH_LIMIT_BYTES),
        ),
        "WORKFLOW_SCRATCH_LIMIT_BYTES",
    )


def directory_size_bytes(path: Path) -> int:
    """Return the total size of regular files below one directory."""
    if not path.exists():
        return 0
    total = 0
    for child in path.rglob("*"):
        if child.is_file():
            total += child.stat().st_size
    return total


def enforce_scratch_limit(path: Path, context: str) -> int:
    """Fail when one run's durable scratch footprint exceeds configured capacity."""
    size = directory_size_bytes(path)
    limit = workflow_scratch_limit_bytes()
    if size > limit:
        raise RuntimeError(
            f"Workflow scratch exceeded {limit} bytes during {context}: "
            f"{size} bytes under {path}."
        )
    return size
