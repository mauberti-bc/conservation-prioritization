"""Portable CPU-capacity detection for bounded worker processes."""

from __future__ import annotations

import os


def available_cpu_count() -> int:
    """Return the logical CPUs available to the current process.

    Process affinity is authoritative when the operating system exposes it,
    because it reflects CPU sets applied by container orchestrators. Platforms
    without affinity support fall back to the machine's logical CPU count.

    Returns:
        A positive number of logical CPUs that the process may use.
    """
    get_affinity = getattr(os, "sched_getaffinity", None)
    if get_affinity is not None:
        try:
            affinity_count = len(get_affinity(0))
        except OSError:
            affinity_count = 0
        if affinity_count > 0:
            return affinity_count

    return max(1, int(os.cpu_count() or 1))
