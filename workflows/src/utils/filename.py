"""Filesystem-safe names for downloadable artifacts."""

import re
import unicodedata


def sanitize_filename_stem(name: str) -> str:
    """Return a bounded ASCII filename stem, falling back to task for empty names."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", normalized).strip("_-")
    return stem[:80].rstrip("_-") or "task"
