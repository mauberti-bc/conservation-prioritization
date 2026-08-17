from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

from .neighbor import NeighborStructure, iter_neighbor_edge_blocks


@dataclass(frozen=True)
class DomainPresolveResult:
    """Fixed planning-unit states derived by lossless domain dominance rules."""

    fixed_values: np.ndarray
    derived_fixed_zero_count: int
    iterations: int


def presolve_planning_unit_domain(
    *,
    objective: np.ndarray,
    fixed_values: np.ndarray,
    relationships: tuple[tuple[np.ndarray, np.ndarray, bool, bool], ...],
    neighbor_structure: NeighborStructure | None,
    neighbor_coefficient: float,
) -> DomainPresolveResult:
    """Iteratively fix flexible decisions out when selection is dominated.

    Aggregate rows protect every variable whose removal or addition could help
    satisfy a bound. For the remaining variables, the direct objective and the
    maximum attainable selected-neighbour reward prove whether zero is at least
    as good in every completion. Repeating the rule lets newly
    fixed neighbours tighten those marginal bounds without approximating the
    original optimization problem.

    Args:
        objective: Direct maximization coefficient for each planning unit.
        fixed_values: Existing states encoded as ``-1`` flexible, ``0`` out,
            and ``1`` in.
        relationships: Sparse aggregate vectors with flags indicating whether
            the layer has any finite lower and upper constraint bounds.
        neighbor_structure: Optional rook-neighbour topology.
        neighbor_coefficient: Nonnegative objective reward per selected pair.

    Returns:
        Stable fixed states and counts of states derived by this presolve.
    """
    resolved = np.asarray(fixed_values, dtype=np.int8).copy()
    direct = np.asarray(objective, dtype=np.float64)
    if direct.shape != resolved.shape:
        raise ValueError("Objective and fixed-state vectors must have equal shape.")
    if neighbor_coefficient < 0:
        raise ValueError("Domain presolve requires a nonnegative neighbour reward.")

    can_fix_zero = np.ones(resolved.shape, dtype=bool)
    for indices, values, has_lower, has_upper in relationships:
        nonzero = values != 0
        relevant_indices = indices[nonzero]
        relevant_values = values[nonzero]
        if has_lower:
            can_fix_zero[relevant_indices[relevant_values > 0]] = False
        if has_upper:
            can_fix_zero[relevant_indices[relevant_values < 0]] = False

    original = resolved.copy()
    iterations = 0
    tolerance = 1e-12
    while True:
        flexible_neighbor_count = np.zeros(resolved.shape, dtype=np.int32)
        selected_neighbor_count = np.zeros(resolved.shape, dtype=np.int32)
        if neighbor_structure is not None and neighbor_coefficient > 0:
            for block in iter_neighbor_edge_blocks(neighbor_structure):
                first_state = resolved[block.first]
                second_state = resolved[block.second]
                np.add.at(
                    flexible_neighbor_count,
                    block.first[second_state < 0],
                    1,
                )
                np.add.at(
                    flexible_neighbor_count,
                    block.second[first_state < 0],
                    1,
                )
                np.add.at(
                    selected_neighbor_count,
                    block.first[second_state == 1],
                    1,
                )
                np.add.at(
                    selected_neighbor_count,
                    block.second[first_state == 1],
                    1,
                )

        flexible = resolved < 0
        minimum_marginal = direct + neighbor_coefficient * selected_neighbor_count
        maximum_marginal = minimum_marginal + (
            neighbor_coefficient * flexible_neighbor_count
        )
        fix_zero = flexible & can_fix_zero & (maximum_marginal <= tolerance)
        if not np.any(fix_zero):
            break
        resolved[fix_zero] = 0
        iterations += 1

    return DomainPresolveResult(
        fixed_values=resolved,
        derived_fixed_zero_count=int(
            np.count_nonzero((original < 0) & (resolved == 0))
        ),
        iterations=iterations,
    )


@dataclass(frozen=True)
class ReductionStatistics:
    """Auditable counts from guarantee-preserving domain presolve."""

    source_planning_units: int
    eligible_planning_units: int
    fixed_in_planning_units: int
    fixed_out_planning_units: int
    zero_contribution_planning_units_removed: int
    dominance_fixed_out_planning_units: int
    domain_presolve_iterations: int
    reduced_candidate_planning_units: int
    solver_planning_unit_variables: int
    original_relationship_nonzeros: int
    retained_relationship_nonzeros: int
    lossless: bool
    blocked_rules: tuple[str, ...]

    def to_dict(self) -> dict[str, int | bool | list[str]]:
        """Return JSON-compatible reduction telemetry."""
        values = asdict(self)
        values["blocked_rules"] = list(self.blocked_rules)
        return values
