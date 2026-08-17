from __future__ import annotations

import time
from threading import Event, Thread, Timer
from typing import Callable, Sequence

import numpy as np

from .model import (
    CompiledOptimizationModel,
    SolveConfiguration,
    SolveScenario,
    SolverResult,
)
from ..utils.cpu import available_cpu_count
from ..utils.memory import process_memory_sample
from .numerical import csr_row_activities

try:
    import highspy
except ImportError:  # pragma: no cover - exercised by deployment validation
    highspy = None


def solve_with_highs(
    model: CompiledOptimizationModel,
    *,
    time_limit_seconds: float | None = None,
    relative_mip_gap: float = 0.0,
    configuration: SolveConfiguration | None = None,
    scenario: SolveScenario | None = None,
    warm_start: np.ndarray | Sequence[float] | None = None,
    progress_callback: Callable[[dict[str, object]], None] | None = None,
) -> SolverResult:
    """Pass a compiled CSR optimization model to HiGHS and return portable metadata."""
    if highspy is None:
        raise RuntimeError(
            "The sparse solver profile must install the highspy dependency."
        )
    resolved_configuration = configuration or SolveConfiguration(
        time_limit_seconds=time_limit_seconds,
        relative_mip_gap=relative_mip_gap,
    )
    with HighsModelSession(model, configuration=resolved_configuration) as session:
        if scenario is not None:
            session.apply_scenario(scenario)
        resolved_warm_start = warm_start
        automatic_warm_start = False
        if resolved_warm_start is None and scenario is None:
            resolved_warm_start = build_objective_warm_start(model)
            automatic_warm_start = resolved_warm_start is not None
        if resolved_warm_start is not None:
            session.apply_warm_start(
                resolved_warm_start,
                retain_as_deadline_fallback=automatic_warm_start,
            )
        return session.solve(progress_callback=progress_callback)


def build_objective_warm_start(
    model: CompiledOptimizationModel,
) -> np.ndarray | None:
    """Build a feasible incumbent from independently positive primary variables.

    The seed starts at every variable's lower bound, selects promising primary
    binaries, and derives selected-neighbour columns from those decisions. The
    seed is returned only when it satisfies the complete compiled model, so
    aggregate constraints or other coupling can safely cause the heuristic to
    be skipped.

    Args:
        model: Complete compiled optimization model.

    Returns:
        A feasible native-column vector, or ``None`` when this simple seed does
        not satisfy the compiled constraints.
    """
    columns = np.asarray(model.variable_lower, dtype=np.float64).copy()
    if columns.shape != (model.variable_count,) or np.any(~np.isfinite(columns)):
        return None
    primary_count = model.primary_variable_count
    positive = np.asarray(model.objective[:primary_count], dtype=np.float64) > 0
    positive_indices = np.flatnonzero(positive)
    columns[positive_indices] = np.asarray(
        model.variable_upper[positive_indices], dtype=np.float64
    )
    _populate_neighbor_columns(model, columns)
    if _columns_are_feasible(model, columns):
        return columns
    baseline = np.asarray(model.variable_lower, dtype=np.float64).copy()
    _populate_neighbor_columns(model, baseline)
    if not _columns_are_feasible(model, baseline):
        return None
    constrained = _build_single_resource_warm_start(
        model,
        baseline,
    )
    return constrained if constrained is not None else baseline


def _build_single_resource_warm_start(
    model: CompiledOptimizationModel,
    baseline: np.ndarray,
) -> np.ndarray | None:
    """Greedily fill one nonnegative upper-bounded aggregate resource row."""
    row_blocks = getattr(model.row_names, "blocks", None)
    if row_blocks is None:
        resource_rows = [
            row_index
            for row_index, name in enumerate(model.row_names)
            if not name.startswith("neighbor_")
        ]
    else:
        resource_rows = [
            row_index
            for name, start, stop in row_blocks
            if not name.startswith("neighbor_")
            for row_index in range(start, stop)
        ]
    if len(resource_rows) != 1:
        return None
    row_index = resource_rows[0]
    if not np.isneginf(model.row_lower[row_index]) or not np.isfinite(
        model.row_upper[row_index]
    ):
        return None
    start = int(model.row_starts[row_index])
    stop = int(model.row_starts[row_index + 1])
    row_columns = np.asarray(model.column_indices[start:stop], dtype=np.int64)
    row_values = np.asarray(model.coefficients[start:stop], dtype=np.float64)
    if np.any(row_values < 0) or np.any(row_columns >= model.primary_variable_count):
        return None
    primary_count = model.primary_variable_count
    costs = np.zeros(primary_count, dtype=np.float64)
    costs[row_columns] = row_values
    candidate_indices = np.flatnonzero(
        np.asarray(model.variable_upper[:primary_count], dtype=np.float64)
        > baseline[:primary_count] + 1e-9
    )
    candidate_values = np.asarray(model.objective[candidate_indices], dtype=np.float64)
    edge_columns, first_columns, second_columns = _neighbor_columns(model)
    if edge_columns.size:
        edge_values = np.asarray(model.objective[edge_columns], dtype=np.float64)
        spatial_potential = np.zeros(primary_count, dtype=np.float64)
        np.add.at(spatial_potential, first_columns, edge_values)
        np.add.at(spatial_potential, second_columns, edge_values)
        candidate_values = candidate_values + spatial_potential[candidate_indices]
    beneficial = candidate_values > 0
    candidate_indices = candidate_indices[beneficial]
    candidate_values = candidate_values[beneficial]
    if candidate_indices.size == 0:
        return None
    candidate_costs = costs[candidate_indices]
    density = np.full(candidate_values.shape, np.inf, dtype=np.float64)
    positive_cost = candidate_costs > 0
    density[positive_cost] = (
        candidate_values[positive_cost] / candidate_costs[positive_cost]
    )
    order = np.argsort(-density, kind="stable")
    ordered_indices = candidate_indices[order]
    ordered_costs = candidate_costs[order]
    baseline_activity = csr_row_activities(model, baseline)[row_index]
    available = float(model.row_upper[row_index] - baseline_activity)
    cumulative = np.cumsum(ordered_costs, dtype=np.float64)
    selected = ordered_indices[cumulative <= available + 1e-9]
    if selected.size == 0:
        return None
    columns = baseline.copy()
    columns[selected] = np.asarray(model.variable_upper[selected], dtype=np.float64)
    _populate_neighbor_columns(model, columns)
    return columns if _columns_are_feasible(model, columns) else None


def _neighbor_columns(
    model: CompiledOptimizationModel,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return aligned auxiliary, first-endpoint, and second-endpoint columns."""
    blocks = getattr(model.row_names, "blocks", ())
    first_block = next(
        (block for block in blocks if block[0] == "neighbor_selected_first"),
        None,
    )
    second_block = next(
        (block for block in blocks if block[0] == "neighbor_selected_second"),
        None,
    )
    if first_block is None or second_block is None:
        empty = np.asarray([], dtype=np.int64)
        return empty, empty, empty
    first_rows = np.arange(first_block[1], first_block[2], dtype=np.int64)
    second_rows = np.arange(second_block[1], second_block[2], dtype=np.int64)
    if first_rows.size != second_rows.size:
        raise ValueError("Neighbor row blocks must contain aligned edge rows.")
    first_starts = np.asarray(model.row_starts[first_rows], dtype=np.int64)
    second_starts = np.asarray(model.row_starts[second_rows], dtype=np.int64)
    auxiliaries = np.asarray(model.column_indices[first_starts], dtype=np.int64)
    first_columns = np.asarray(model.column_indices[first_starts + 1], dtype=np.int64)
    second_columns = np.asarray(model.column_indices[second_starts + 1], dtype=np.int64)
    return auxiliaries, first_columns, second_columns


def _populate_neighbor_columns(
    model: CompiledOptimizationModel,
    columns: np.ndarray,
) -> None:
    """Set selected-neighbour auxiliaries consistently with primary decisions."""
    auxiliaries, first_columns, second_columns = _neighbor_columns(model)
    if auxiliaries.size:
        columns[auxiliaries] = np.minimum(
            columns[first_columns],
            columns[second_columns],
        )


class HighsModelSession:
    """Own one mutable HiGHS model for memory-bounded incremental solves."""

    def __init__(
        self,
        model: CompiledOptimizationModel,
        *,
        time_limit_seconds: float | None = None,
        relative_mip_gap: float = 0.0,
        configuration: SolveConfiguration | None = None,
    ) -> None:
        """Load a compiled CSR model exactly once into a HiGHS instance."""
        if highspy is None:
            raise RuntimeError(
                "The sparse solver profile must install the highspy dependency."
            )
        self._model = model
        self._configuration = configuration or SolveConfiguration(
            time_limit_seconds=time_limit_seconds,
            relative_mip_gap=relative_mip_gap,
        )
        self._resolved_thread_count = (
            self._configuration.thread_count or available_cpu_count()
        )
        self._thread_count_source = (
            "configured"
            if self._configuration.thread_count is not None
            else "process_available_cpus"
        )
        self._scenario_rows: set[int] = set()
        self._scenario_columns: set[int] = set()
        self._deadline_fallback: np.ndarray | None = None
        self._memory_profile = {"before_highspy": process_memory_sample()}
        load_started = time.perf_counter()
        self._solver = highspy.Highs()
        self._solver.setOptionValue(
            "output_flag", bool(self._configuration.output_flag)
        )
        self._solver.setOptionValue(
            "mip_rel_gap", float(self._configuration.effective_relative_mip_gap)
        )
        if self._configuration.effective_absolute_mip_gap is not None:
            self._solver.setOptionValue(
                "mip_abs_gap", float(self._configuration.effective_absolute_mip_gap)
            )
        if self._configuration.time_limit_seconds is not None:
            self._solver.setOptionValue(
                "time_limit", float(self._configuration.time_limit_seconds)
            )
        self._solver.setOptionValue("threads", int(self._resolved_thread_count))
        self._solver.setOptionValue("parallel", "choose")
        self._solver.setOptionValue("random_seed", int(self._configuration.random_seed))
        for name, value in (self._configuration.options or {}).items():
            self._solver.setOptionValue(name, value)
        variable_count = model.variable_count
        self._solver.addVars(
            variable_count,
            np.asarray(model.variable_lower, dtype=np.float64),
            np.asarray(model.variable_upper, dtype=np.float64),
        )
        column_batch_size = 262144
        for start in range(0, variable_count, column_batch_size):
            stop = min(start + column_batch_size, variable_count)
            indices = np.arange(start, stop, dtype=np.int32)
            self._solver.changeColsCost(
                len(indices),
                indices,
                np.asarray(model.objective[start:stop], dtype=np.float64),
            )
            self._solver.changeColsIntegrality(
                len(indices),
                indices,
                np.asarray(model.integrality[start:stop], dtype=np.uint8),
            )
        self._solver.addRows(
            model.constraint_count,
            np.asarray(model.row_lower, dtype=np.float64),
            np.asarray(model.row_upper, dtype=np.float64),
            model.nonzero_count,
            np.asarray(model.row_starts, dtype=np.int64),
            np.asarray(model.column_indices, dtype=np.int32),
            np.asarray(model.coefficients, dtype=np.float64),
        )
        if model.objective_offset != 0:
            self._solver.changeObjectiveOffset(float(model.objective_offset))
        if model.maximize:
            self._solver.changeObjectiveSense(highspy.ObjSense.kMaximize)
        self._model_load_seconds = time.perf_counter() - load_started
        self._memory_profile["after_model_transfer"] = process_memory_sample()

    def __enter__(self) -> "HighsModelSession":
        """Return this active model session."""
        return self

    def __exit__(self, *_: object) -> None:
        """Release the native solver model promptly."""
        self.close()

    def close(self) -> None:
        """Release native HiGHS allocations."""
        if self._solver is not None:
            self._solver.clear()
            self._solver = None

    def change_row_bounds(
        self,
        row_index: int,
        lower: float,
        upper: float,
    ) -> None:
        """Change one resource or constraint row without rebuilding the model."""
        self._require_open().changeRowBounds(row_index, float(lower), float(upper))

    def change_column_bounds(
        self,
        indices: Sequence[int] | np.ndarray,
        lower: Sequence[float] | np.ndarray,
        upper: Sequence[float] | np.ndarray,
    ) -> None:
        """Change many column bounds without rebuilding the native model."""
        columns = np.asarray(indices, dtype=np.int32)
        lower_bounds = np.asarray(lower, dtype=np.float64)
        upper_bounds = np.asarray(upper, dtype=np.float64)
        if columns.ndim != 1:
            raise ValueError("Column indices must be one-dimensional.")
        if lower_bounds.shape != columns.shape or upper_bounds.shape != columns.shape:
            raise ValueError("Column bound arrays must align with column indices.")
        if np.any(columns < 0) or np.any(columns >= self._model.variable_count):
            raise ValueError("Column bound update references an invalid column.")
        if np.any(lower_bounds > upper_bounds):
            raise ValueError("Column lower bounds cannot exceed upper bounds.")
        status = self._require_open().changeColsBounds(
            len(columns),
            columns,
            lower_bounds,
            upper_bounds,
        )
        if status != highspy.HighsStatus.kOk:
            raise ValueError("HiGHS rejected the column-bound update.")

    def apply_scenario(self, scenario: SolveScenario) -> None:
        """Apply one solve-only scenario after restoring the compiled baseline."""
        solver = self._require_open()
        for row_index in self._scenario_rows:
            solver.changeRowBounds(
                row_index,
                float(self._model.row_lower[row_index]),
                float(self._model.row_upper[row_index]),
            )
        for column_index in self._scenario_columns:
            solver.changeColBounds(
                column_index,
                float(self._model.variable_lower[column_index]),
                float(self._model.variable_upper[column_index]),
            )
        self._scenario_rows.clear()
        self._scenario_columns.clear()
        for override in scenario.row_bounds:
            if (
                override.row_index < 0
                or override.row_index >= self._model.constraint_count
            ):
                raise ValueError("Solve scenario references an invalid row index.")
            if override.lower > override.upper:
                raise ValueError(
                    "Solve scenario row lower bound exceeds its upper bound."
                )
            solver.changeRowBounds(
                override.row_index,
                float(override.lower),
                float(override.upper),
            )
            self._scenario_rows.add(override.row_index)
        for override in scenario.column_bounds:
            if (
                override.column_index < 0
                or override.column_index >= self._model.variable_count
            ):
                raise ValueError("Solve scenario references an invalid column index.")
            if override.lower > override.upper:
                raise ValueError(
                    "Solve scenario column lower bound exceeds its upper bound."
                )
            solver.changeColBounds(
                override.column_index,
                float(override.lower),
                float(override.upper),
            )
            self._scenario_columns.add(override.column_index)

    def apply_warm_start(
        self,
        values: Sequence[float] | np.ndarray,
        *,
        retain_as_deadline_fallback: bool = False,
    ) -> None:
        """Apply one solve-specific incumbent without changing model identity."""
        columns = np.asarray(values, dtype=np.float64).copy()
        if columns.shape != (self._model.variable_count,):
            raise ValueError("Warm start must contain one value per solver column.")
        if np.any(~np.isfinite(columns)):
            raise ValueError("Warm start contains a non-finite value.")
        _populate_neighbor_columns(self._model, columns)
        indices = np.arange(self._model.variable_count, dtype=np.int32)
        status = self._require_open().setSolution(len(indices), indices, columns)
        if status != highspy.HighsStatus.kOk:
            raise ValueError("HiGHS rejected the supplied warm start.")
        if retain_as_deadline_fallback:
            if not _columns_are_feasible(self._model, columns):
                raise ValueError("Deadline fallback must be independently feasible.")
            self._deadline_fallback = columns.copy()

    def solve(
        self,
        *,
        progress_callback: Callable[[dict[str, object]], None] | None = None,
    ) -> SolverResult:
        """Solve the current model state and return portable result metadata."""
        solver = self._require_open()
        started = time.perf_counter()
        stopped = Event()
        phase = {"value": "solving"}

        def cancel_at_deadline() -> None:
            solver.cancelSolve()

        def heartbeat() -> None:
            while not stopped.wait(5.0):
                if progress_callback is not None:
                    progress_callback(
                        {
                            "phase": phase["value"],
                            "elapsed_seconds": time.perf_counter() - started,
                            "memory": process_memory_sample(),
                        }
                    )

        thread = Thread(target=heartbeat, daemon=True)
        thread.start()
        watchdog = None
        if self._configuration.time_limit_seconds is not None:
            watchdog = Timer(
                float(self._configuration.time_limit_seconds), cancel_at_deadline
            )
            watchdog.daemon = True
            watchdog.start()
        try:
            solve_started = time.perf_counter()
            solver.run()
            solve_seconds = time.perf_counter() - solve_started
        finally:
            if watchdog is not None:
                watchdog.cancel()
                watchdog.join(timeout=1.0)
            stopped.set()
            thread.join(timeout=1.0)
        self._memory_profile["after_highs_solve"] = process_memory_sample()
        runtime = time.perf_counter() - started
        status = (
            solver.modelStatusToString(solver.getModelStatus())
            .lower()
            .replace(" ", "_")
        )
        solution = solver.getSolution()
        info = solver.getInfo()
        native_columns = np.asarray(solution.col_value, dtype=np.float64)
        objective = float(info.objective_function_value)
        has_incumbent = self._has_certified_feasible_incumbent(
            solution,
            info,
            native_columns,
        )
        if has_incumbent:
            _populate_neighbor_columns(self._model, native_columns)
            objective = float(
                np.dot(self._model.objective, native_columns)
                + self._model.objective_offset
            )
        limit_termination = status.startswith(("time_limit", "interrupt"))
        fallback_used = False
        if (
            limit_termination
            and not has_incumbent
            and self._deadline_fallback is not None
        ):
            native_columns = self._deadline_fallback.copy()
            objective = float(
                np.dot(self._model.objective, native_columns)
                + self._model.objective_offset
            )
            has_incumbent = True
            fallback_used = True
        if limit_termination and has_incumbent:
            status = "feasible"
        decisions = self._planning_unit_decisions(native_columns)
        gap = float(info.mip_gap) if np.isfinite(info.mip_gap) else None
        if status == "optimal" and gap is not None and abs(gap) > 1e-12:
            status = "feasible"
        best_bound = (
            float(info.mip_dual_bound) if np.isfinite(info.mip_dual_bound) else None
        )
        absolute_gap = (
            abs(objective - best_bound)
            if np.isfinite(objective) and best_bound is not None
            else None
        )
        get_presolved_model = getattr(solver, "getPresolvedLp", None)
        presolved_model = (
            get_presolved_model() if get_presolved_model is not None else None
        )
        presolved_integrality = (
            np.asarray(presolved_model.integrality_)
            if presolved_model is not None
            else np.asarray([], dtype=np.uint8)
        )
        diagnostics = {
            "original_model": {
                "columns": self._model.variable_count,
                "integer_columns": int(np.count_nonzero(self._model.integrality)),
                "rows": self._model.constraint_count,
                "nonzeros": self._model.nonzero_count,
            },
            "presolved_model": {
                "columns": (
                    int(presolved_model.num_col_)
                    if presolved_model is not None
                    else None
                ),
                "integer_columns": (
                    int(np.count_nonzero(presolved_integrality))
                    if presolved_model is not None
                    else None
                ),
                "rows": (
                    int(presolved_model.num_row_)
                    if presolved_model is not None
                    else None
                ),
                "nonzeros": (
                    len(presolved_model.a_matrix_.value_)
                    if presolved_model is not None
                    else None
                ),
            },
            "simplex_iterations": int(getattr(info, "simplex_iteration_count", 0)),
            "ipm_iterations": int(getattr(info, "ipm_iteration_count", 0)),
            "primal_dual_integral": (
                float(getattr(info, "primal_dual_integral", np.nan))
                if np.isfinite(getattr(info, "primal_dual_integral", np.nan))
                else None
            ),
            "max_primal_infeasibility": (
                float(getattr(info, "max_primal_infeasibility", np.nan))
                if np.isfinite(getattr(info, "max_primal_infeasibility", np.nan))
                else None
            ),
            "max_dual_infeasibility": (
                float(getattr(info, "max_dual_infeasibility", np.nan))
                if np.isfinite(getattr(info, "max_dual_infeasibility", np.nan))
                else None
            ),
            "max_integrality_violation": (
                float(getattr(info, "max_integrality_violation", np.nan))
                if np.isfinite(getattr(info, "max_integrality_violation", np.nan))
                else None
            ),
        }
        return SolverResult(
            status=status,
            objective_value=objective if np.isfinite(objective) else None,
            optimality_gap=gap,
            runtime_seconds=runtime,
            solver_name="highs",
            solver_version=solver.version(),
            decisions=decisions,
            termination_reason=solver.modelStatusToString(solver.getModelStatus()),
            best_bound=best_bound,
            absolute_gap=absolute_gap,
            node_count=int(info.mip_node_count),
            model_load_seconds=self._model_load_seconds,
            presolve_seconds=None,
            solve_seconds=solve_seconds,
            solver_settings={
                "time_limit_seconds": self._configuration.time_limit_seconds,
                "relative_mip_gap": self._configuration.effective_relative_mip_gap,
                "absolute_mip_gap": self._configuration.effective_absolute_mip_gap,
                "thread_count": self._resolved_thread_count,
                "thread_count_source": self._thread_count_source,
                "parallel": (self._configuration.options or {}).get(
                    "parallel", "choose"
                ),
                "random_seed": self._configuration.random_seed,
                "output_flag": self._configuration.output_flag,
                "mode": self._configuration.mode,
                "options": dict(self._configuration.options or {}),
                "deadline_fallback_used": fallback_used,
            },
            native_columns=native_columns,
            memory_profile=dict(self._memory_profile),
            diagnostics=diagnostics,
        )

    def _is_feasible_incumbent(self, columns: np.ndarray) -> bool:
        """Validate a time-limited incumbent against the compiled mathematics."""
        return _columns_are_feasible(self._model, columns)

    def _has_certified_feasible_incumbent(
        self,
        solution,
        info,
        columns: np.ndarray,
    ) -> bool:
        """Require HiGHS to report a real primal solution before validation."""
        if not bool(solution.value_valid):
            return False
        if int(info.primal_solution_status) != int(highspy.kSolutionStatusFeasible):
            return False
        if not np.isfinite(float(info.objective_function_value)):
            return False
        return self._is_feasible_incumbent(columns)

    def _planning_unit_decisions(self, native_columns: np.ndarray) -> np.ndarray:
        """Reconstruct the stable full spatial vector from compact solver columns."""
        return native_columns[: self._model.primary_variable_count].copy()

    def _require_open(self):
        """Return the native solver or fail after session closure."""
        if self._solver is None:
            raise RuntimeError("The HiGHS model session is closed.")
        return self._solver


def require_acceptable_result(
    result: SolverResult,
    configuration: SolveConfiguration,
    model: CompiledOptimizationModel | None = None,
) -> None:
    """Reject a solve that does not meet the configured certification contract.

    Standard solves accept either a proven optimum or an independently feasible
    incumbent. Exact audits accept only HiGHS' proven-optimal status and a
    numerically zero certified gap.
    """
    if configuration.mode == "exact_audit":
        if model is not None and not np.any(np.asarray(model.integrality) != 0):
            if result.status != "optimal":
                raise RuntimeError("Exact audit requires a HiGHS-proven LP optimum.")
            return
        gap = result.optimality_gap
        if result.status != "optimal" or gap is None or abs(gap) > 1e-12:
            raise RuntimeError(
                "Exact audit requires a HiGHS-proven optimum with zero gap."
            )
        return
    if result.status not in {"optimal", "feasible"}:
        raise RuntimeError(
            "Standard optimization did not produce a certified feasible incumbent: "
            f"{result.status}."
        )


def _columns_are_feasible(
    model: CompiledOptimizationModel,
    columns: np.ndarray,
) -> bool:
    """Return whether native columns satisfy bounds, integrality, and all rows."""
    if columns.shape != (model.variable_count,) or not np.all(np.isfinite(columns)):
        return False
    tolerance = 1e-6
    if np.any(columns < model.variable_lower - tolerance) or np.any(
        columns > model.variable_upper + tolerance
    ):
        return False
    integer = model.integrality != 0
    if np.any(np.abs(columns[integer] - np.rint(columns[integer])) > tolerance):
        return False
    activities = csr_row_activities(model, columns)
    return bool(
        np.all(activities >= model.row_lower - tolerance)
        and np.all(activities <= model.row_upper + tolerance)
    )
