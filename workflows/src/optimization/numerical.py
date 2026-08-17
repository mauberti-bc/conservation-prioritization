from __future__ import annotations

import numpy as np

from .model import CompiledOptimizationModel


def csr_row_activities(
    model: CompiledOptimizationModel,
    columns: np.ndarray,
    *,
    nonzero_batch_size: int = 1_048_576,
) -> np.ndarray:
    """Evaluate CSR rows with bounded temporary memory per nonzero batch."""
    activities = np.zeros(model.constraint_count, dtype=np.float64)
    row_ends = np.asarray(model.row_starts[1:], dtype=np.int64)
    for start in range(0, model.nonzero_count, nonzero_batch_size):
        stop = min(start + nonzero_batch_size, model.nonzero_count)
        positions = np.arange(start, stop, dtype=np.int64)
        rows = np.searchsorted(row_ends, positions, side="right")
        weighted = np.asarray(model.coefficients[start:stop]) * columns[
            np.asarray(model.column_indices[start:stop], dtype=np.int64)
        ]
        if rows.size == 0:
            continue
        group_starts = np.concatenate(
            (np.asarray([0], dtype=np.int64), np.flatnonzero(np.diff(rows)) + 1)
        )
        activities[rows[group_starts]] += np.add.reduceat(weighted, group_starts)
    return activities
