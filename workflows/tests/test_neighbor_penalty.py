from __future__ import annotations

import unittest
from types import SimpleNamespace

import numpy as np

from src.optimization import highs as highs_adapter
from src.optimization.neighbor import (
    NeighborPenaltySpecification,
    encode_packed_mask,
    iter_neighbor_edge_blocks,
    load_neighbor_structure,
)
from src.optimization.compiler import (
    SparseConstraintSpecification,
    compile_spatial_optimization,
)
from src.optimization.highs import (
    HighsModelSession,
    build_objective_warm_start,
    solve_with_highs,
)
from src.optimization.reconstruction import reconstruct_compilation_result


class NeighborPenaltyTest(unittest.TestCase):
    """Verify topology and normalized selected-pair coupling in the linear MILP."""

    def test_marginal_neighbor_model_dimensions_are_explicit(self) -> None:
        """Compare objective-only, aggregate, and neighbor MILP structure."""
        objective_only = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=4,
            constraints=[],
            fused_objective=np.ones(4, dtype=np.float64),
        ).model
        aggregate = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=4,
            constraints=[
                SparseConstraintSpecification(
                    "selected_units",
                    np.arange(4, dtype=np.int32),
                    np.ones(4, dtype=np.float64),
                    [(None, 2.0)],
                )
            ],
            fused_objective=np.ones(4, dtype=np.float64),
        ).model
        neighbor = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=4,
            constraints=[],
            fused_objective=np.ones(4, dtype=np.float64),
            neighbor_penalty=NeighborPenaltySpecification(strength=1),
            neighbor_structure=_structure(
                [_tile(0, 0, np.ones((2, 2), dtype=bool), 0)],
                height=2,
                width=2,
                planning_unit_count=4,
            ),
        ).model

        self.assertEqual(
            (4, 0, 0, 0),
            (
                objective_only.primary_variable_count,
                objective_only.variable_count - objective_only.primary_variable_count,
                objective_only.constraint_count,
                objective_only.nonzero_count,
            ),
        )
        self.assertEqual(
            (4, 0, 1, 4),
            (
                aggregate.primary_variable_count,
                aggregate.variable_count - aggregate.primary_variable_count,
                aggregate.constraint_count,
                aggregate.nonzero_count,
            ),
        )
        self.assertEqual(
            (4, 4, 8, 16),
            (
                neighbor.primary_variable_count,
                neighbor.variable_count - neighbor.primary_variable_count,
                neighbor.constraint_count,
                neighbor.nonzero_count,
            ),
        )

    def test_edges_are_emitted_once_across_tile_seams(self) -> None:
        structure = _structure(
            [
                _tile(0, 0, np.asarray([[1, 1], [1, 0]], dtype=bool), 0),
                _tile(0, 2, np.asarray([[1], [1]], dtype=bool), 3),
            ],
            height=2,
            width=3,
            planning_unit_count=5,
        )
        edges = {
            (int(first), int(second))
            for block in iter_neighbor_edge_blocks(structure)
            for first, second in zip(block.first, block.second, strict=True)
        }
        self.assertEqual(edges, {(0, 1), (0, 2), (1, 3), (3, 4)})

    def test_neighbor_penalty_compiles_with_an_aggregate_selection_cap(self) -> None:
        structure = _structure(
            [_tile(0, 0, np.ones((1, 2), dtype=bool), 0)],
            height=1,
            width=2,
            planning_unit_count=2,
        )
        compilation = compile_spatial_optimization(
            planning_units=np.asarray([[0, 0], [0, 1]]),
            constraints=[
                SparseConstraintSpecification(
                    "selected_units",
                    np.arange(2, dtype=np.int32),
                    np.ones(2, dtype=np.float64),
                    [(None, 1.0)],
                )
            ],
            fused_objective=np.asarray([2.0, 1.0]),
            neighbor_penalty=NeighborPenaltySpecification(strength=3),
            neighbor_structure=structure,
        )
        result = reconstruct_compilation_result(
            solve_with_highs(compilation.model), compilation.reconstruction
        )
        self.assertEqual(result.decisions.tolist(), [1.0, 0.0])
        self.assertEqual(result.objective_value, 2.0)
        self.assertEqual(result.raw_neighbor_value, 0.0)
        self.assertEqual(result.neighbor_penalty_contribution, 0.0)
        self.assertEqual(compilation.model.integrality.tolist(), [1, 1, 0])
        self.assertEqual(compilation.model.constraint_count, 3)
        self.assertEqual(compilation.model.nonzero_count, 6)

    def test_neighbor_strength_applies_after_global_edge_normalization(self) -> None:
        structure = _structure(
            [_tile(0, 0, np.ones((1, 3), dtype=bool), 0)],
            height=1,
            width=3,
            planning_unit_count=3,
        )
        compilation = compile_spatial_optimization(
            planning_units=np.asarray([[0, 0], [0, 1], [0, 2]]),
            constraints=[
                SparseConstraintSpecification(
                    "selected_units",
                    np.arange(3, dtype=np.int32),
                    np.ones(3, dtype=np.float64),
                    [(None, 1.0)],
                )
            ],
            fused_objective=np.asarray([2.0, 1.0, 0.0]),
            neighbor_penalty=NeighborPenaltySpecification(strength=3),
            neighbor_structure=structure,
        )
        result = reconstruct_compilation_result(
            solve_with_highs(compilation.model), compilation.reconstruction
        )
        self.assertEqual(result.decisions.tolist(), [1.0, 0.0, 0.0])
        self.assertEqual(2.0, compilation.reconstruction.neighbor.normalization_scale)
        self.assertEqual(1.5, compilation.reconstruction.neighbor.resolved_coefficient)
        self.assertEqual(0.0, result.raw_neighbor_value)
        self.assertEqual(0.0, result.neighbor_penalty_contribution)

    def test_neighbor_penalty_prefers_compact_selection(self) -> None:
        structure = _structure(
            [_tile(0, 0, np.ones((1, 4), dtype=bool), 0)],
            height=1,
            width=4,
            planning_unit_count=4,
        )
        compilation = compile_spatial_optimization(
            planning_units=np.asarray([[0, 0], [0, 1], [0, 2], [0, 3]]),
            constraints=[
                SparseConstraintSpecification(
                    "selected_units",
                    np.arange(4, dtype=np.int32),
                    np.ones(4, dtype=np.float64),
                    [(2.0, 2.0)],
                )
            ],
            fused_objective=np.asarray([3.0, 1.0, 3.0, 0.0]),
            neighbor_penalty=NeighborPenaltySpecification(strength=7),
            neighbor_structure=structure,
        )
        result = reconstruct_compilation_result(
            solve_with_highs(compilation.model), compilation.reconstruction
        )
        selected = np.flatnonzero(result.decisions >= 0.5)
        self.assertEqual(len(selected), 2)
        self.assertEqual(int(selected[1] - selected[0]), 1)
        self.assertEqual(result.raw_neighbor_value, 1.0)
        self.assertAlmostEqual(result.neighbor_penalty_contribution, 7 / 3)

    def test_neighbor_model_receives_nonzero_feasible_warm_start(self) -> None:
        structure = _structure(
            [_tile(0, 0, np.ones((1, 3), dtype=bool), 0)],
            height=1,
            width=3,
            planning_unit_count=3,
        )
        compilation = compile_spatial_optimization(
            planning_units=np.asarray([[0, 0], [0, 1], [0, 2]]),
            constraints=[],
            fused_objective=np.asarray([0.5, -0.25, 1.0]),
            neighbor_penalty=NeighborPenaltySpecification(strength=1),
            neighbor_structure=structure,
        )
        warm_start = build_objective_warm_start(compilation.model)
        self.assertIsNotNone(warm_start)
        np.testing.assert_array_equal(
            np.asarray(warm_start)[:3], np.asarray([1.0, 0.0, 1.0])
        )
        np.testing.assert_array_equal(
            np.asarray(warm_start)[3:], np.asarray([0.0, 0.0])
        )

    def test_warm_start_populates_selected_neighbor_columns(self) -> None:
        structure = _structure(
            [_tile(0, 0, np.ones((1, 2), dtype=bool), 0)],
            height=1,
            width=2,
            planning_unit_count=2,
        )
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            constraints=[],
            fused_objective=np.asarray([1.0, 0.5]),
            neighbor_penalty=NeighborPenaltySpecification(strength=1),
            neighbor_structure=structure,
        )

        warm_start = build_objective_warm_start(compilation.model)

        self.assertIsNotNone(warm_start)
        np.testing.assert_array_equal(
            np.asarray(warm_start), np.asarray([1.0, 1.0, 1.0])
        )

    def test_time_limited_incumbent_populates_selected_neighbor_columns(self) -> None:
        """Canonicalize a feasible incumbent before reporting its objective."""
        structure = _structure(
            [_tile(0, 0, np.ones((1, 2), dtype=bool), 0)],
            height=1,
            width=2,
            planning_unit_count=2,
        )
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            constraints=[],
            fused_objective=np.asarray([1.0, 0.5]),
            neighbor_penalty=NeighborPenaltySpecification(strength=1),
            neighbor_structure=structure,
        )
        session = HighsModelSession(compilation.model)
        session._solver.clear()
        session._solver = _TimeLimitedSolverWithUnsaturatedNeighborIncumbent()

        with session:
            result = session.solve()

        self.assertEqual("feasible", result.status)
        np.testing.assert_array_equal(
            result.native_columns,
            np.asarray([1.0, 1.0, 1.0]),
        )
        self.assertEqual(2.5, result.objective_value)

    def test_domain_presolve_iterates_after_neighbor_removal(self) -> None:
        structure = _structure(
            [_tile(0, 0, np.ones((1, 3), dtype=bool), 0)],
            height=1,
            width=3,
            planning_unit_count=3,
        )
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=3,
            constraints=[],
            fused_objective=np.asarray([-0.6, -0.6, 1.0]),
            neighbor_penalty=NeighborPenaltySpecification(strength=1),
            neighbor_structure=structure,
        )

        self.assertEqual(1, compilation.model.primary_variable_count)
        self.assertEqual(0, compilation.model.variable_count - 1)
        self.assertEqual(
            [0, 0, -1],
            compilation.reconstruction.planning_unit_fixed_values.tolist(),
        )
        self.assertEqual(
            2,
            compilation.reconstruction.reduction.zero_contribution_planning_units_removed,
        )
        self.assertEqual(
            2,
            compilation.reconstruction.reduction.dominance_fixed_out_planning_units,
        )
        self.assertEqual(
            2,
            compilation.reconstruction.reduction.domain_presolve_iterations,
        )
        self.assertEqual(
            2.0,
            compilation.reconstruction.neighbor.normalization_scale,
        )

    def test_fixed_neighbor_edges_fold_to_equivalent_objective_terms(self) -> None:
        structure = _structure(
            [
                _tile(
                    0,
                    0,
                    np.ones((1, 3), dtype=bool),
                    0,
                    fixed_zero=np.asarray([[1, 0, 0]], dtype=bool),
                    fixed_one=np.asarray([[0, 0, 1]], dtype=bool),
                )
            ],
            height=1,
            width=3,
            planning_unit_count=3,
        )
        compilation = compile_spatial_optimization(
            planning_units=np.asarray([[0, 0], [0, 1], [0, 2]]),
            constraints=[],
            fused_objective=np.zeros(3, dtype=np.float64),
            neighbor_penalty=NeighborPenaltySpecification(strength=2),
            neighbor_structure=structure,
        )
        result = reconstruct_compilation_result(
            solve_with_highs(compilation.model), compilation.reconstruction
        )
        self.assertEqual(compilation.model.primary_variable_count, 1)
        self.assertEqual(compilation.model.variable_count, 1)
        self.assertEqual(result.decisions.tolist(), [0.0, 1.0, 1.0])
        self.assertEqual(result.raw_neighbor_value, 1.0)
        self.assertEqual(result.neighbor_penalty_contribution, 2.0)
        self.assertEqual(result.objective_value, 2.0)


def _tile(
    row: int,
    col: int,
    mask: np.ndarray,
    offset: int,
    fixed_zero: np.ndarray | None = None,
    fixed_one: np.ndarray | None = None,
) -> dict[str, object]:
    zeros = np.zeros(mask.shape, dtype=bool)
    return {
        "tile_id": f"{row}-{col}",
        "row_start": row,
        "row_stop": row + mask.shape[0],
        "col_start": col,
        "col_stop": col + mask.shape[1],
        "variable_index_offset": offset,
        "valid_planning_unit_count": int(np.count_nonzero(mask)),
        "eligibility_mask": encode_packed_mask(mask),
        "fixed0_mask": encode_packed_mask(
            fixed_zero if fixed_zero is not None else zeros
        ),
        "fixed1_mask": encode_packed_mask(
            fixed_one if fixed_one is not None else zeros
        ),
    }


def _structure(tiles: list[dict[str, object]], **dimensions: int):
    return load_neighbor_structure(
        {
            "neighbor_method": "selected_rook_pairs",
            "neighbor_method_version": 1,
            "tile_size": 2,
            "tiles": tiles,
            **dimensions,
        }
    )


class _TimeLimitedSolverWithUnsaturatedNeighborIncumbent:
    """Return a feasible primary selection with a stale derived pair column."""

    def run(self) -> None:
        """Return immediately at a simulated time limit."""

    def getModelStatus(self):
        """Return an opaque native status token."""
        return None

    def modelStatusToString(self, _status) -> str:
        """Describe the simulated native termination."""
        return "Time limit reached"

    def getSolution(self):
        """Return selected endpoints with an unsaturated pair auxiliary."""
        return SimpleNamespace(col_value=[1.0, 1.0, 0.0], value_valid=True)

    def getInfo(self):
        """Return feasible incumbent metadata for the simulated solve."""
        return SimpleNamespace(
            primal_solution_status=int(highs_adapter.highspy.kSolutionStatusFeasible),
            objective_function_value=1.5,
            mip_gap=np.inf,
            mip_dual_bound=np.inf,
            mip_node_count=0,
        )

    def version(self) -> str:
        """Return a stable simulated solver version."""
        return "test"

    def clear(self) -> None:
        """Release the simulated solver."""


if __name__ == "__main__":
    unittest.main()
