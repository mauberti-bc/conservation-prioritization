from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Sequence

import numpy as np

from .neighbor import (
    NeighborPenaltySpecification,
    NeighborStructure,
    iter_neighbor_edge_blocks,
    planning_fixed_values,
    resolve_neighbor_normalization,
)
from .model import (
    NeighborCompilationMetadata,
    CanonicalObjectiveValues,
    CompilationOutput,
    CompilationReconstruction,
    CompactRowNames,
    CompiledOptimizationModel,
)
from .reduction import (
    DomainPresolveResult,
    ReductionStatistics,
    presolve_planning_unit_domain,
)


ConstraintSpecification = tuple[float | None, float | None]
DecisionDomain = Literal["continuous", "discrete"]


@dataclass(frozen=True)
class SparseConstraintSpecification:
    """Sparse coefficients for aggregate constraints on one layer."""

    layer_id: str
    indices: np.ndarray
    values: np.ndarray
    constraints: Sequence[ConstraintSpecification]


@dataclass(frozen=True)
class SparseMatrixDimensions:
    """Exact row and coefficient counts for the emitted CSR matrix."""

    constraint_rows: int
    matrix_nonzeros: int


def measure_sparse_constraints(
    *,
    variable_count: int,
    feature_vectors: Sequence[tuple[int, Sequence[ConstraintSpecification]]],
) -> SparseMatrixDimensions:
    """Measure the exact CSR dimensions produced by the sparse compiler."""
    if variable_count < 0 or any(count < 0 for count, _ in feature_vectors):
        raise ValueError("Sparse vector counts cannot be negative.")
    constraint_rows = sum(
        _constraint_bound_count(constraints) for _, constraints in feature_vectors
    )
    matrix_nonzeros = sum(
        count * _constraint_bound_count(constraints)
        for count, constraints in feature_vectors
    )
    return SparseMatrixDimensions(
        constraint_rows=constraint_rows,
        matrix_nonzeros=matrix_nonzeros,
    )


def compile_spatial_optimization(
    *,
    planning_units: np.ndarray | Sequence[tuple[int, int]] | None,
    planning_unit_count: int | None = None,
    constraints: Sequence[SparseConstraintSpecification],
    neighbor_penalty: NeighborPenaltySpecification | None = None,
    neighbor_structure: NeighborStructure | None = None,
    array_directory: Path | None = None,
    fused_objective: np.ndarray | None = None,
    canonical_objectives: Sequence[CanonicalObjectiveValues] = (),
    decision_domain: DecisionDomain = "discrete",
    preserve_primary_domain: bool = False,
    allocation_target_row: bool = False,
) -> CompilationOutput:
    """Compile conservation semantics into preallocated solver-neutral CSR arrays.

    When ``array_directory`` is supplied, all model-scale arrays are memory mapped
    so compilation does not require a second in-memory representation of the model.
    """
    if decision_domain not in {"continuous", "discrete"}:
        raise ValueError("Decision domain must be continuous or discrete.")

    planning_unit_array = (
        np.asanyarray(planning_units, dtype=np.int32)
        if planning_units is not None
        else None
    )
    resolved_planning_unit_count = (
        len(planning_unit_array)
        if planning_unit_array is not None
        else planning_unit_count
    )
    if resolved_planning_unit_count is None or resolved_planning_unit_count < 0:
        raise ValueError("A nonnegative planning-unit count is required.")
    planning_unit_count = int(resolved_planning_unit_count)

    primary_objective = (
        np.asanyarray(fused_objective, dtype=np.float64)
        if fused_objective is not None
        else np.zeros(planning_unit_count, dtype=np.float64)
    )
    fixed_values = (
        planning_fixed_values(neighbor_structure)
        if neighbor_structure is not None
        else np.full(planning_unit_count, -1, dtype=np.int8)
    )
    if primary_objective.shape != (planning_unit_count,):
        raise ValueError("Fused objective does not match the candidate domain.")
    if fixed_values.shape != (planning_unit_count,):
        raise ValueError("Fixed decisions do not match the candidate domain.")
    for feature in constraints:
        indices = np.asarray(feature.indices, dtype=np.int32)
        values = np.asarray(feature.values, dtype=np.float64)
        _validate_sparse_vector(feature.layer_id, indices, values, planning_unit_count)

    relationship_vectors = [
        (
            np.asarray(feature.indices, dtype=np.int32),
            np.asarray(feature.values, dtype=np.float64),
            any(minimum is not None for minimum, _ in feature.constraints),
            any(maximum is not None for _, maximum in feature.constraints),
        )
        for feature in constraints
    ]
    neighbor_normalization = None
    if (neighbor_penalty is None) != (neighbor_structure is None):
        raise ValueError(
            "Neighbor specification and planning structure must be supplied together."
        )
    if neighbor_structure is not None and neighbor_penalty is not None:
        if neighbor_structure.planning_unit_count != planning_unit_count:
            raise ValueError(
                "Neighbor structure planning-unit count differs from model."
            )
        attainable_edge_count = 0
        for block in iter_neighbor_edge_blocks(neighbor_structure):
            attainable_edge_count += int(
                np.count_nonzero(
                    (fixed_values[block.first] != 0) & (fixed_values[block.second] != 0)
                )
            )
        neighbor_normalization = resolve_neighbor_normalization(
            neighbor_penalty,
            attainable_edge_count,
        )
    presolve = (
        DomainPresolveResult(
            fixed_values=np.asarray(fixed_values, dtype=np.int8).copy(),
            derived_fixed_zero_count=0,
            iterations=0,
        )
        if preserve_primary_domain
        else presolve_planning_unit_domain(
            objective=primary_objective,
            fixed_values=fixed_values,
            relationships=tuple(relationship_vectors),
            neighbor_structure=neighbor_structure,
            neighbor_coefficient=(
                neighbor_normalization.resolved_coefficient
                if neighbor_normalization is not None
                else 0.0
            ),
        )
    )
    compiled_fixed_values = presolve.fixed_values
    flexible = compiled_fixed_values < 0
    planning_to_solver = np.full(planning_unit_count, -1, dtype=np.int64)
    planning_to_solver[flexible] = np.arange(
        int(np.count_nonzero(flexible)), dtype=np.int64
    )
    primary_variable_count = int(np.count_nonzero(flexible))
    objective_offset = float(np.sum(primary_objective[compiled_fixed_values == 1]))
    original_relationship_nonzeros = sum(
        int(np.count_nonzero(values)) for _, values, _, _ in relationship_vectors
    )
    retained_relationship_nonzeros = sum(
        int(np.count_nonzero((values != 0) & flexible[indices]))
        for indices, values, _, _ in relationship_vectors
    )
    reduction = ReductionStatistics(
        source_planning_units=planning_unit_count,
        eligible_planning_units=planning_unit_count,
        fixed_in_planning_units=int(np.count_nonzero(compiled_fixed_values == 1)),
        fixed_out_planning_units=int(np.count_nonzero(compiled_fixed_values == 0)),
        zero_contribution_planning_units_removed=presolve.derived_fixed_zero_count,
        dominance_fixed_out_planning_units=presolve.derived_fixed_zero_count,
        domain_presolve_iterations=presolve.iterations,
        reduced_candidate_planning_units=primary_variable_count,
        solver_planning_unit_variables=primary_variable_count,
        original_relationship_nonzeros=original_relationship_nonzeros,
        retained_relationship_nonzeros=retained_relationship_nonzeros,
        lossless=True,
        blocked_rules=(),
    )

    neighbor_counts = {
        "raw": 0,
        "constant": 0,
        "constant_selected": 0,
        "unary": 0,
        "fixed0_unary": 0,
        "fixed1_unary": 0,
        "pairwise": 0,
    }
    if neighbor_structure is not None:
        for block in iter_neighbor_edge_blocks(neighbor_structure):
            first_state = compiled_fixed_values[block.first]
            second_state = compiled_fixed_values[block.second]
            first_fixed = first_state >= 0
            second_fixed = second_state >= 0
            constant = first_fixed & second_fixed
            unary = first_fixed ^ second_fixed
            fixed_state = np.where(first_fixed, first_state, second_state)
            neighbor_counts["raw"] += block.count
            neighbor_counts["constant"] += int(np.count_nonzero(constant))
            neighbor_counts["constant_selected"] += int(
                np.count_nonzero(constant & (first_state == 1) & (second_state == 1))
            )
            neighbor_counts["unary"] += int(np.count_nonzero(unary))
            neighbor_counts["fixed0_unary"] += int(
                np.count_nonzero(unary & (fixed_state == 0))
            )
            neighbor_counts["fixed1_unary"] += int(
                np.count_nonzero(unary & (fixed_state == 1))
            )
            neighbor_counts["pairwise"] += int(
                np.count_nonzero(~first_fixed & ~second_fixed)
            )
    auxiliary_count = neighbor_counts["pairwise"]
    variable_count = primary_variable_count + auxiliary_count

    def allocate(
        name: str,
        shape: int,
        dtype: type[np.generic],
        fill: float | int | None = None,
    ) -> np.ndarray:
        if array_directory is None:
            values = np.empty(shape, dtype=dtype)
        else:
            array_directory.mkdir(parents=True, exist_ok=True)
            values = np.lib.format.open_memmap(
                array_directory / f"{name}.npy",
                mode="w+",
                dtype=dtype,
                shape=(shape,),
            )
        if fill is not None:
            values.fill(fill)
        return values

    objective = allocate("objective", variable_count, np.float64, 0)
    variable_lower = allocate("variable-lower", variable_count, np.float64, 0)
    variable_upper = allocate("variable-upper", variable_count, np.float64, 1)
    integrality = allocate("integrality", variable_count, np.uint8, 0)
    if decision_domain == "discrete":
        integrality[:primary_variable_count] = 1
    objective[:primary_variable_count] = primary_objective[flexible]

    compiled_rows: list[tuple[np.ndarray, np.ndarray, float, float, str]] = []

    def compile_row(
        indices: np.ndarray,
        values: np.ndarray,
        lower: float,
        upper: float,
        name: str,
    ) -> None:
        fixed_one = compiled_fixed_values[indices] == 1
        contribution = float(np.sum(values[fixed_one]))
        retained = compiled_fixed_values[indices] < 0
        retained_indices = planning_to_solver[indices[retained]].astype(
            np.int32, copy=False
        )
        retained_values = values[retained]
        adjusted_lower = lower - contribution
        adjusted_upper = upper - contribution
        nonzero = retained_values != 0
        retained_indices = retained_indices[nonzero]
        retained_values = retained_values[nonzero]
        possible_minimum = float(np.sum(retained_values[retained_values < 0]))
        possible_maximum = float(np.sum(retained_values[retained_values > 0]))
        if adjusted_lower <= possible_minimum and adjusted_upper >= possible_maximum:
            return
        if retained_indices.size == 0:
            if adjusted_lower <= 0 <= adjusted_upper:
                return
            raise ValueError(f"Compiled constant row is infeasible: {name}.")
        compiled_rows.append(
            (
                retained_indices,
                retained_values,
                adjusted_lower,
                adjusted_upper,
                name,
            )
        )

    for feature in constraints:
        indices = np.asarray(feature.indices, dtype=np.int32)
        values = np.asarray(feature.values, dtype=np.float64)
        for minimum, maximum in feature.constraints:
            if minimum is not None:
                compile_row(
                    indices,
                    values,
                    float(minimum),
                    np.inf,
                    f"{feature.layer_id}_minimum",
                )
            if maximum is not None:
                compile_row(
                    indices,
                    values,
                    -np.inf,
                    float(maximum),
                    f"{feature.layer_id}_maximum",
                )
    if allocation_target_row:
        compiled_rows.append(
            (
                np.arange(primary_variable_count, dtype=np.int32),
                np.ones(primary_variable_count, dtype=np.float64),
                0.0,
                0.0,
                "priority_allocation_target",
            )
        )

    neighbor_row_count = 2 * neighbor_counts["pairwise"]
    row_count = len(compiled_rows) + neighbor_row_count
    nonzero_count = (
        sum(len(row[0]) for row in compiled_rows) + 4 * neighbor_counts["pairwise"]
    )

    row_starts = allocate("row-starts", row_count + 1, np.int64, 0)
    column_indices = allocate("column-indices", nonzero_count, np.int32)
    coefficients = allocate("coefficients", nonzero_count, np.float64)
    row_lower = allocate("row-lower", row_count, np.float64, -np.inf)
    row_upper = allocate("row-upper", row_count, np.float64, np.inf)
    row_names: list[str] = []
    row_offset = 0
    nonzero_offset = 0

    def append_row(
        indices: np.ndarray,
        values: np.ndarray,
        lower: float,
        upper: float,
        name: str,
    ) -> None:
        nonlocal row_offset, nonzero_offset
        next_nonzero = nonzero_offset + len(indices)
        column_indices[nonzero_offset:next_nonzero] = indices
        coefficients[nonzero_offset:next_nonzero] = values
        row_lower[row_offset] = lower
        row_upper[row_offset] = upper
        row_names.append(name)
        row_offset += 1
        nonzero_offset = next_nonzero
        row_starts[row_offset] = nonzero_offset

    for indices, values, lower, upper, name in compiled_rows:
        append_row(indices, values, lower, upper, name)

    neighbor_metadata = None
    if neighbor_structure is not None and neighbor_penalty is not None:
        if neighbor_normalization is None:
            raise RuntimeError("Neighbor normalization was not resolved.")
        coefficient = neighbor_normalization.resolved_coefficient
        neighbor_row_start = row_offset
        neighbor_nonzero_start = nonzero_offset
        pairwise_count = neighbor_counts["pairwise"]
        row_starts[neighbor_row_start:] = neighbor_nonzero_start + 2 * np.arange(
            neighbor_row_count + 1,
            dtype=np.int64,
        )
        row_upper[neighbor_row_start:] = 0
        pairwise_index = 0
        for block in iter_neighbor_edge_blocks(neighbor_structure):
            first_state = compiled_fixed_values[block.first]
            second_state = compiled_fixed_values[block.second]
            first_fixed = first_state >= 0
            second_fixed = second_state >= 0
            constant = first_fixed & second_fixed
            objective_offset += coefficient * int(
                np.count_nonzero(constant & (first_state == 1) & (second_state == 1))
            )

            unary = first_fixed ^ second_fixed
            if np.any(unary):
                flexible_endpoints = np.where(
                    first_fixed[unary],
                    block.second[unary],
                    block.first[unary],
                )
                fixed_states = np.where(
                    first_fixed[unary],
                    first_state[unary],
                    second_state[unary],
                )
                unary_columns = planning_to_solver[flexible_endpoints]
                fixed_in = fixed_states == 1
                np.add.at(
                    objective,
                    unary_columns[fixed_in],
                    coefficient,
                )

            pairwise = ~first_fixed & ~second_fixed
            block_pairwise_count = int(np.count_nonzero(pairwise))
            if block_pairwise_count == 0:
                continue
            pairwise_stop = pairwise_index + block_pairwise_count
            first_columns = planning_to_solver[block.first[pairwise]].astype(
                np.int32, copy=False
            )
            second_columns = planning_to_solver[block.second[pairwise]].astype(
                np.int32, copy=False
            )
            auxiliary_columns = np.arange(
                primary_variable_count + pairwise_index,
                primary_variable_count + pairwise_stop,
                dtype=np.int32,
            )
            objective[auxiliary_columns] = coefficient

            first_start = neighbor_nonzero_start + 2 * pairwise_index
            first_stop = neighbor_nonzero_start + 2 * pairwise_stop
            column_indices[first_start:first_stop:2] = auxiliary_columns
            column_indices[first_start + 1 : first_stop : 2] = first_columns
            coefficients[first_start:first_stop:2] = 1
            coefficients[first_start + 1 : first_stop : 2] = -1

            second_start = (
                neighbor_nonzero_start + 2 * pairwise_count + 2 * pairwise_index
            )
            second_stop = (
                neighbor_nonzero_start + 2 * pairwise_count + 2 * pairwise_stop
            )
            column_indices[second_start:second_stop:2] = auxiliary_columns
            column_indices[second_start + 1 : second_stop : 2] = second_columns
            coefficients[second_start:second_stop:2] = 1
            coefficients[second_start + 1 : second_stop : 2] = -1
            pairwise_index = pairwise_stop
        row_offset = row_count
        nonzero_offset = nonzero_count
        neighbor_metadata = NeighborCompilationMetadata(
            specification=neighbor_penalty,
            structure=neighbor_structure,
            raw_neighbor_edge_count=neighbor_counts["raw"],
            constant_neighbor_edge_count=neighbor_counts["constant"],
            constant_selected_neighbor_edge_count=neighbor_counts["constant_selected"],
            unary_neighbor_edge_count=neighbor_counts["unary"],
            fixed0_unary_neighbor_edge_count=neighbor_counts["fixed0_unary"],
            fixed1_unary_neighbor_edge_count=neighbor_counts["fixed1_unary"],
            pairwise_neighbor_edge_count=neighbor_counts["pairwise"],
            normalization_method=neighbor_normalization.normalization_method,
            normalization_method_version=(
                neighbor_normalization.normalization_method_version
            ),
            normalization_scale=neighbor_normalization.normalization_scale,
            resolved_coefficient=neighbor_normalization.resolved_coefficient,
            status=neighbor_normalization.status,
        )

    if row_offset != row_count or nonzero_offset != nonzero_count:
        raise RuntimeError("Sparse compiler sizing did not match emitted model arrays.")
    compact_row_names = CompactRowNames.from_names(row_names)
    if neighbor_row_count:
        compact_row_names = CompactRowNames(
            (
                *compact_row_names.blocks,
                (
                    "neighbor_selected_first",
                    len(compiled_rows),
                    len(compiled_rows) + neighbor_counts["pairwise"],
                ),
                (
                    "neighbor_selected_second",
                    len(compiled_rows) + neighbor_counts["pairwise"],
                    row_count,
                ),
            ),
            row_count,
        )
    model = CompiledOptimizationModel(
        objective=objective,
        variable_lower=variable_lower,
        variable_upper=variable_upper,
        integrality=integrality,
        row_starts=row_starts,
        column_indices=column_indices,
        coefficients=coefficients,
        row_lower=row_lower,
        row_upper=row_upper,
        row_names=compact_row_names,
        primary_variable_count=primary_variable_count,
        objective_offset=objective_offset,
    )
    reconstruction = CompilationReconstruction(
        planning_units=planning_unit_array,
        planning_unit_solver_columns=planning_to_solver,
        planning_unit_fixed_values=compiled_fixed_values,
        compiled_primary_objective=primary_objective,
        canonical_objectives=tuple(canonical_objectives),
        neighbor=neighbor_metadata,
        reduction=reduction,
    )
    return CompilationOutput(model=model, reconstruction=reconstruction)


def _constraint_bound_count(
    constraints: Sequence[ConstraintSpecification],
) -> int:
    return sum(
        int(minimum is not None) + int(maximum is not None)
        for minimum, maximum in constraints
    )


def _validate_sparse_vector(
    name: str,
    indices: np.ndarray,
    values: np.ndarray,
    variable_count: int,
) -> None:
    if indices.ndim != 1 or values.ndim != 1 or len(indices) != len(values):
        raise ValueError(f"{name} indices and values must be equal-length vectors.")
    if np.any(indices < 0) or np.any(indices >= variable_count):
        raise ValueError(f"{name} contains a planning-unit index outside the model.")
    if np.any(~np.isfinite(values)):
        raise ValueError(f"{name} contains a non-finite coefficient.")
