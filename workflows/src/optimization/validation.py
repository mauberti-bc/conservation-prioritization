from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

from .model import CompiledOptimizationModel, SolverResult
from .numerical import csr_row_activities


@dataclass(frozen=True)
class AuthoritativeValidation:
    """Report whether a reconstructed result satisfies compiled mathematics."""

    accepted: bool
    objective_value: float
    maximum_row_violation: float
    maximum_bound_violation: float
    maximum_integrality_violation: float
    failures: tuple[str, ...]
    selected_planning_unit_ids: np.ndarray


def reconstruct_and_validate(
    model: CompiledOptimizationModel,
    result: SolverResult,
    *,
    candidate_planning_unit_ids: np.ndarray | Sequence[int],
    fixed_planning_unit_ids: np.ndarray | Sequence[int] = (),
    fixed_values: np.ndarray | Sequence[int] = (),
    tolerance: float = 1e-6,
    collect_selected_ids: bool = True,
    variable_upper_override: tuple[int, float] | None = None,
) -> AuthoritativeValidation:
    """Reconstruct stable identities and independently validate a solver result."""
    columns = np.asarray(
        (
            result.native_columns
            if result.native_columns is not None
            else result.decisions
        ),
        dtype=np.float64,
    )
    if columns.shape != (model.variable_count,):
        raise ValueError("Solver columns do not match the compiled model.")
    candidate_ids = np.asarray(candidate_planning_unit_ids, dtype=np.uint64)
    primary_count = len(candidate_ids)
    if primary_count > model.variable_count:
        raise ValueError("Candidate mapping exceeds the solver column count.")
    fixed_ids = np.asarray(fixed_planning_unit_ids, dtype=np.uint64)
    fixed_state = np.asarray(fixed_values, dtype=np.int8)
    if fixed_ids.shape != fixed_state.shape:
        raise ValueError("Fixed planning-unit reconstruction arrays must align.")

    variable_upper = np.asarray(model.variable_upper)
    if variable_upper_override is not None:
        column, upper = variable_upper_override
        if column < 0 or column >= model.variable_count:
            raise ValueError("Variable-bound validation override is invalid.")
        variable_upper = variable_upper.copy()
        variable_upper[column] = upper
    maximum_bound_violation = _maximum_bound_violation(
        columns,
        model.variable_lower,
        variable_upper,
    )
    integer = np.asarray(model.integrality) != 0
    maximum_integrality_violation = float(
        np.max(np.abs(columns[integer] - np.rint(columns[integer])), initial=0.0)
    )
    activities = csr_row_activities(model, columns)
    maximum_row_violation = _maximum_bound_violation(
        activities,
        model.row_lower,
        model.row_upper,
    )
    objective = float(np.dot(model.objective, columns) + model.objective_offset)
    failures: list[str] = []
    if maximum_bound_violation > tolerance:
        failures.append("variable_bound_violation")
    if maximum_integrality_violation > tolerance:
        failures.append("integrality_violation")
    if maximum_row_violation > tolerance:
        failures.append("constraint_violation")
    if (
        result.objective_value is not None
        and abs(objective - result.objective_value)
        > tolerance * max(1.0, abs(objective))
    ):
        failures.append("objective_mismatch")

    if np.intersect1d(candidate_ids, fixed_ids, assume_unique=True).size:
        raise ValueError("A planning-unit ID is both candidate and fixed.")
    selected = (
        np.sort(
            np.concatenate(
                (
                    candidate_ids[columns[:primary_count] >= 0.5],
                    fixed_ids[fixed_state == 1],
                )
            )
        )
        if collect_selected_ids
        else np.empty(0, dtype=np.uint64)
    )
    return AuthoritativeValidation(
        accepted=not failures,
        objective_value=objective,
        maximum_row_violation=maximum_row_violation,
        maximum_bound_violation=maximum_bound_violation,
        maximum_integrality_violation=maximum_integrality_violation,
        failures=tuple(failures),
        selected_planning_unit_ids=selected,
    )


def _maximum_bound_violation(
    values: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
    *,
    batch_size: int = 1_048_576,
) -> float:
    """Measure bound violation without allocating full-size difference arrays."""
    maximum = 0.0
    for start in range(0, len(values), batch_size):
        stop = min(start + batch_size, len(values))
        batch = values[start:stop]
        maximum = max(
            maximum,
            float(np.max(lower[start:stop] - batch, initial=0.0)),
            float(np.max(batch - upper[start:stop], initial=0.0)),
        )
    return maximum
