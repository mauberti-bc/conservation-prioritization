from __future__ import annotations

from dataclasses import replace

import numpy as np

from .neighbor import raw_neighbor_value
from .model import CompilationReconstruction, SolverResult


def reconstruct_compilation_result(
    result: SolverResult,
    reconstruction: CompilationReconstruction,
) -> SolverResult:
    """Map compact primary columns back to the compiler's source domain."""
    native = np.asarray(
        (
            result.native_columns
            if result.native_columns is not None
            else result.decisions
        ),
        dtype=np.float64,
    )
    mapping = reconstruction.planning_unit_solver_columns
    fixed = reconstruction.planning_unit_fixed_values
    decisions = np.zeros(reconstruction.planning_unit_count, dtype=np.float64)
    decisions[fixed == 1] = 1.0
    flexible = mapping >= 0
    decisions[flexible] = native[mapping[flexible]]
    conservation_benefit = float(
        np.dot(reconstruction.compiled_primary_objective, decisions)
    )
    neighbor_value = None
    neighbor_contribution = None
    if reconstruction.neighbor is not None:
        neighbor_value = raw_neighbor_value(
            reconstruction.neighbor.structure,
            decisions,
        )
        neighbor_contribution = float(
            reconstruction.neighbor.resolved_coefficient * neighbor_value
        )
    return replace(
        result,
        decisions=decisions,
        raw_conservation_benefit=conservation_benefit,
        raw_neighbor_value=neighbor_value,
        neighbor_penalty_contribution=neighbor_contribution,
    )
