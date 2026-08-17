"""Portable process-memory diagnostics for bounded optimization phases."""

from __future__ import annotations

import resource
import sys

import psutil


def process_memory_sample() -> dict[str, int]:
    """Return current and lifetime-peak resident memory in bytes."""
    peak = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    if sys.platform != "darwin":
        peak *= 1024
    return {
        "current_rss_bytes": int(psutil.Process().memory_info().rss),
        "peak_rss_bytes": peak,
    }
