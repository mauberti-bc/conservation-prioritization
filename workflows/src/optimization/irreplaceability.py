from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence

import numpy as np

from .highs import HighsModelSession, require_acceptable_result
from .model import (
    ColumnBoundOverride,
    CompiledOptimizationModel,
    SolveConfiguration,
    SolveScenario,
    SolverResult,
)
from .validation import reconstruct_and_validate


@dataclass(frozen=True)
class PlanningUnitIrreplaceability:
    """Optimal conservation opportunity loss for one planning unit."""

    planning_unit_id: int
    solver_column: int
    selected_in_reference_solution: bool
    counterfactual_status: str
    counterfactual_feasible: bool
    counterfactual_solved: bool
    replacement_status: Literal["replaceable", "absolutely_irreplaceable"]
    counterfactual_objective: float | None
    replacement_cost_absolute: float | None
    replacement_cost_relative: float | None
    best_bound: float | None
    optimality_gap: float | None


@dataclass(frozen=True)
class IrreplaceabilityResult:
    """Scientifically explicit exclusion analysis over one compiled model."""

    reference_objective: float
    reference_status: str
    planning_units: tuple[PlanningUnitIrreplaceability, ...]


def analyze_irreplaceability(
    model: CompiledOptimizationModel,
    reference_result: SolverResult,
    *,
    candidate_planning_unit_ids: np.ndarray | Sequence[int],
    requested_planning_unit_ids: np.ndarray | Sequence[int] | None = None,
    configuration: SolveConfiguration | None = None,
    maximum_scenarios: int | None = None,
    use_warm_starts: bool = True,
) -> IrreplaceabilityResult:
    """Compute exact or certified replacement costs using bound overrides.

    The compiled coefficients and sparse matrix are loaded into HiGHS once. Each
    scenario changes only one primary variable's upper bound to zero. Replacement
    cost is ``z_reference - z_without_unit`` for maximization and the sign-reversed
    equivalent for minimization.

    Parameters:
        model: Immutable compiled optimization model reused by every scenario.
        reference_result: Accepted reference solve against the unchanged model.
        candidate_planning_unit_ids: Stable IDs in primary solver-column order.
        requested_planning_unit_ids: Optional bounded subset to analyze.
        configuration: Authoritative settings for every counterfactual solve.
        maximum_scenarios: Maximum number of actual HiGHS exclusion solves.
        use_warm_starts: Whether to offer bound-compatible reference values to HiGHS.

    Returns:
        Per-unit absolute and reference-relative replacement costs.

    Raises:
        ValueError: If mappings, reference values, or requested IDs are invalid.
        RuntimeError: If a counterfactual does not meet the solve contract or
            fails independent numerical validation.
    """
    candidate_ids = np.asarray(candidate_planning_unit_ids, dtype=np.uint64)
    if candidate_ids.shape != (model.primary_variable_count,):
        raise ValueError(
            "Candidate planning-unit IDs must match primary solver columns."
        )
    if candidate_ids.size > 1 and np.unique(candidate_ids).size != candidate_ids.size:
        raise ValueError("Candidate planning-unit IDs must be unique.")
    reference_objective = reference_result.objective_value
    if reference_objective is None or not np.isfinite(reference_objective):
        raise ValueError("Irreplaceability requires a finite reference objective.")
    reference_columns = np.asarray(
        reference_result.native_columns
        if reference_result.native_columns is not None
        else reference_result.decisions,
        dtype=np.float64,
    )
    if reference_columns.shape != (model.variable_count,):
        raise ValueError("Reference solve columns do not match the compiled model.")

    solve_configuration = configuration or SolveConfiguration()
    require_acceptable_result(reference_result, solve_configuration)
    requested = (
        candidate_ids
        if requested_planning_unit_ids is None
        else np.asarray(requested_planning_unit_ids, dtype=np.uint64)
    )
    if requested.size > 1 and np.unique(requested).size != requested.size:
        raise ValueError("Requested planning-unit IDs must be unique.")
    column_by_id = {
        int(planning_unit_id): column
        for column, planning_unit_id in enumerate(candidate_ids)
    }
    unknown = [int(value) for value in requested if int(value) not in column_by_id]
    if unknown:
        raise ValueError(
            "Irreplaceability requested planning units outside the flexible "
            f"candidate domain: {unknown[:5]}."
        )

    reference_is_optimal = _is_proven_optimal(reference_result)
    selected_in_reference = reference_columns[: model.primary_variable_count] >= 0.5
    scenario_count = sum(
        1
        for planning_unit_id in requested
        if not (
            reference_is_optimal
            and not selected_in_reference[column_by_id[int(planning_unit_id)]]
        )
    )
    if maximum_scenarios is not None:
        if maximum_scenarios < 0:
            raise ValueError("Maximum irreplaceability scenarios cannot be negative.")
        if scenario_count > maximum_scenarios:
            raise ValueError(
                "Irreplaceability requires "
                f"{scenario_count} counterfactual solves, exceeding the configured "
                f"limit ({maximum_scenarios})."
            )

    results: list[PlanningUnitIrreplaceability] = []
    with HighsModelSession(model, configuration=solve_configuration) as session:
        for planning_unit_id in requested:
            column = column_by_id[int(planning_unit_id)]
            selected = bool(selected_in_reference[column])
            if reference_is_optimal and not selected:
                results.append(
                    PlanningUnitIrreplaceability(
                        planning_unit_id=int(planning_unit_id),
                        solver_column=column,
                        selected_in_reference_solution=False,
                        counterfactual_status="not_solved_reference_optimum",
                        counterfactual_feasible=True,
                        counterfactual_solved=False,
                        replacement_status="replaceable",
                        counterfactual_objective=float(reference_objective),
                        replacement_cost_absolute=0.0,
                        replacement_cost_relative=(
                            0.0 if abs(reference_objective) > 0 else None
                        ),
                        best_bound=reference_result.best_bound,
                        optimality_gap=reference_result.optimality_gap,
                    )
                )
                continue
            session.apply_scenario(
                SolveScenario(
                    scenario_id=f"exclude:{int(planning_unit_id)}",
                    column_bounds=(
                        ColumnBoundOverride(
                            column_index=column,
                            lower=float(model.variable_lower[column]),
                            upper=0.0,
                        ),
                    ),
                )
            )
            if use_warm_starts:
                session.apply_warm_start(
                    _exclusion_warm_start(reference_columns, column)
                )
            counterfactual = session.solve()
            if counterfactual.status == "infeasible":
                results.append(
                    PlanningUnitIrreplaceability(
                        planning_unit_id=int(planning_unit_id),
                        solver_column=column,
                        selected_in_reference_solution=selected,
                        counterfactual_status=counterfactual.status,
                        counterfactual_feasible=False,
                        counterfactual_solved=True,
                        replacement_status="absolutely_irreplaceable",
                        counterfactual_objective=None,
                        replacement_cost_absolute=None,
                        replacement_cost_relative=None,
                        best_bound=counterfactual.best_bound,
                        optimality_gap=counterfactual.optimality_gap,
                    )
                )
                continue
            require_acceptable_result(counterfactual, solve_configuration)
            validation = reconstruct_and_validate(
                model,
                counterfactual,
                candidate_planning_unit_ids=candidate_ids,
                collect_selected_ids=False,
                variable_upper_override=(column, 0.0),
            )
            if not validation.accepted:
                raise RuntimeError(
                    "Irreplaceability counterfactual failed independent validation: "
                    f"{', '.join(validation.failures)}."
                )
            counterfactual_objective = counterfactual.objective_value
            if counterfactual_objective is None:
                raise RuntimeError(
                    "Irreplaceability counterfactual has no finite objective."
                )
            loss = (
                reference_objective - counterfactual_objective
                if model.maximize
                else counterfactual_objective - reference_objective
            )
            tolerance = 1e-6 * max(
                1.0,
                abs(float(reference_objective)),
                abs(float(counterfactual_objective)),
            )
            if loss < -tolerance:
                raise RuntimeError(
                    "Excluding a planning unit materially improved the objective; "
                    "the reference and counterfactual solve certifications are not "
                    "sufficiently consistent for opportunity-loss reporting."
                )
            opportunity_loss = max(0.0, float(loss))
            scale = abs(reference_objective)
            results.append(
                PlanningUnitIrreplaceability(
                    planning_unit_id=int(planning_unit_id),
                    solver_column=column,
                    selected_in_reference_solution=selected,
                    counterfactual_status=counterfactual.status,
                    counterfactual_feasible=True,
                    counterfactual_solved=True,
                    replacement_status="replaceable",
                    counterfactual_objective=counterfactual_objective,
                    replacement_cost_absolute=opportunity_loss,
                    replacement_cost_relative=(
                        opportunity_loss / scale if scale > 0 else None
                    ),
                    best_bound=counterfactual.best_bound,
                    optimality_gap=counterfactual.optimality_gap,
                )
            )
    return IrreplaceabilityResult(
        reference_objective=float(reference_objective),
        reference_status=reference_result.status,
        planning_units=tuple(results),
    )


def _exclusion_warm_start(reference_columns: np.ndarray, column: int) -> np.ndarray:
    """Return reference values modified only to satisfy the exclusion bound."""
    values = reference_columns.copy()
    values[column] = 0.0
    return values


def _is_proven_optimal(result: SolverResult) -> bool:
    """Return whether HiGHS certified the reference objective as optimal."""
    return result.status == "optimal" and (
        result.optimality_gap is None or abs(result.optimality_gap) <= 1e-12
    )
