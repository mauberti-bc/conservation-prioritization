from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

import numpy as np


OBJECTIVE_NORMALIZATION_METHOD = "top_k_attainable"
OBJECTIVE_NORMALIZATION_VERSION = 1


@dataclass(frozen=True)
class ObjectiveNormalization:
    """Record how one canonical objective becomes a solver coefficient."""

    layer: str
    direction: Literal["maximize", "minimize"]
    importance: float
    normalization_method: str
    normalization_method_version: int
    normalization_scale: float
    resolved_coefficient: float
    status: Literal["active", "degenerate"]
    selection_count: int
    selection_count_method: str

    def to_dict(self) -> dict[str, object]:
        """Return deterministic JSON-compatible compilation provenance."""
        return asdict(self)


def resolve_objective_normalization(
    *,
    layer: str,
    direction: Literal["maximize", "minimize"],
    importance: float,
    attainable_scale: float,
    selection_count: int,
) -> ObjectiveNormalization:
    """Resolve one positive scale before applying direction and importance."""
    if not layer:
        raise ValueError("Objective layer identity cannot be empty.")
    if not np.isfinite(importance) or importance < 0:
        raise ValueError("Objective importance must be finite and nonnegative.")
    if selection_count < 0:
        raise ValueError("Objective selection count cannot be negative.")
    if not np.isfinite(attainable_scale) or attainable_scale < 0:
        raise ValueError("Objective normalization scale cannot be negative.")
    active = attainable_scale > 0
    sign = 1.0 if direction == "maximize" else -1.0
    return ObjectiveNormalization(
        layer=layer,
        direction=direction,
        importance=float(importance),
        normalization_method=OBJECTIVE_NORMALIZATION_METHOD,
        normalization_method_version=OBJECTIVE_NORMALIZATION_VERSION,
        normalization_scale=float(attainable_scale),
        resolved_coefficient=(
            sign * float(importance) / float(attainable_scale) if active else 0.0
        ),
        status="active" if active else "degenerate",
        selection_count=selection_count,
        selection_count_method="eligible_domain_upper_bound",
    )


def top_k_attainable_scale(values: np.ndarray, selection_count: int) -> float:
    """Return the sum of the largest K finite positive canonical contributions."""
    if selection_count < 0:
        raise ValueError("Objective selection count cannot be negative.")
    canonical = np.asarray(values, dtype=np.float64).reshape(-1)
    positive = canonical[np.isfinite(canonical) & (canonical > 0)]
    if selection_count == 0 or positive.size == 0:
        return 0.0
    if positive.size <= selection_count:
        return float(np.sum(positive, dtype=np.float64))
    start = positive.size - selection_count
    return float(np.sum(np.partition(positive, start)[start:], dtype=np.float64))
