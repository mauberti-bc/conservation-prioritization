import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import numpy as np
from pydantic import ValidationError

from src.optimization.compiler import (
    SparseConstraintSpecification,
    compile_spatial_optimization,
)
from src.optimization.artifact import load_compiled_artifact, write_compiled_artifact
from src.optimization.highs import (
    HighsModelSession,
    build_objective_warm_start,
    solve_with_highs,
)
from src.optimization.model import SolveConfiguration
from src.optimization.priority_ranking import solve_priority_ranking
from src.utils.cpu import available_cpu_count
from src.optimization.objective import (
    resolve_objective_normalization,
    top_k_attainable_scale,
)
from src.tasks.spatial_compilation import OptimizationParameters


class _TimeLimitedSolverWithoutIncumbent:
    """Minimal solver double for deadline-fallback result handling."""

    def run(self) -> None:
        """Return as though HiGHS reached its configured time limit."""
        return

    def getModelStatus(self):
        """Return an opaque native status token."""
        return None

    def modelStatusToString(self, _status) -> str:
        """Describe the simulated native termination."""
        return "Time limit reached"

    def getSolution(self):
        """Return HiGHS' no-incumbent solution representation."""
        return SimpleNamespace(col_value=[0.0, 0.0], value_valid=False)

    def getInfo(self):
        """Return metadata with no primal objective or dual bound."""
        return SimpleNamespace(
            primal_solution_status=0,
            objective_function_value=np.inf,
            mip_gap=np.inf,
            mip_dual_bound=np.inf,
            mip_node_count=0,
        )

    def version(self) -> str:
        """Return a stable simulated solver version."""
        return "test"

    def clear(self) -> None:
        """Release the simulated solver."""
        return


class OptimizationProblemTest(unittest.TestCase):
    """Verify the small mathematical submission and compiler contracts."""

    def test_problem_accepts_explicit_objectives_and_constraints(self) -> None:
        problem = OptimizationParameters(
            target_area={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]],
                        },
                    }
                ],
            },
            resolution=30,
            resampling="mode",
            objectives=[
                {"layer": "habitat/value", "direction": "maximize", "importance": 50}
            ],
            constraints=[
                {"type": "aggregate", "layer": "cost/value", "max": 5_000_000},
                {"type": "planning_unit", "layer": "mine/distance", "min": 10_000},
            ],
            layer_contracts={
                "habitat/value": {},
                "cost/value": {},
                "mine/distance": {},
            },
        )
        self.assertEqual("maximize", problem.objectives[0].direction)
        self.assertEqual("aggregate", problem.constraints[0].type)

    def test_objective_importance_must_be_nonnegative(self) -> None:
        with self.assertRaises(ValidationError):
            OptimizationParameters(
                target_area={"type": "Point", "coordinates": [0, 0]},
                resolution=30,
                resampling="mode",
                objectives=[
                    {
                        "layer": "habitat/value",
                        "direction": "maximize",
                        "importance": -1,
                    }
                ],
                layer_contracts={"habitat/value": {}},
            )

    def test_cost_is_an_ordinary_aggregate_constraint_layer(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=3,
            fused_objective=np.asarray([0.9, 0.8, 0.1]),
            constraints=[
                SparseConstraintSpecification(
                    "acquisition_cost",
                    np.arange(3, dtype=np.int32),
                    np.asarray([4.0, 3.0, 1.0]),
                    [(None, 5.0)],
                )
            ],
        )
        result = solve_with_highs(compilation.model)
        self.assertEqual(result.decisions[:3].tolist(), [1.0, 0.0, 1.0])

    def test_continuous_decision_domain_solves_fractional_allocation(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([1.0, 0.5]),
            constraints=[
                SparseConstraintSpecification(
                    "allocation_cap",
                    np.arange(2, dtype=np.int32),
                    np.ones(2, dtype=np.float64),
                    [(None, 1.5)],
                )
            ],
            decision_domain="continuous",
        )

        self.assertEqual(
            [0, 0],
            compilation.model.integrality[
                : compilation.model.primary_variable_count
            ].tolist(),
        )
        result = solve_with_highs(compilation.model)
        np.testing.assert_allclose(result.decisions[:2], np.asarray([1.0, 0.5]))

    def test_discrete_decision_domain_preserves_binary_integrality(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([1.0, 0.5]),
            constraints=[
                SparseConstraintSpecification(
                    "allocation_cap",
                    np.arange(2, dtype=np.int32),
                    np.ones(2, dtype=np.float64),
                    [(None, 1.5)],
                )
            ],
            decision_domain="discrete",
        )

        self.assertEqual(
            [1, 1],
            compilation.model.integrality[
                : compilation.model.primary_variable_count
            ].tolist(),
        )
        result = solve_with_highs(compilation.model)
        self.assertEqual(result.decisions[:2].tolist(), [1.0, 0.0])

    def test_priority_ranking_solves_nested_exact_allocations(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=3,
            fused_objective=np.asarray([3.0, 2.0, 1.0]),
            constraints=[],
            decision_domain="continuous",
            preserve_primary_domain=True,
            allocation_target_row=True,
        )

        with TemporaryDirectory() as directory:
            ranking = solve_priority_ranking(
                compilation.model,
                configuration=SolveConfiguration(),
                work_directory=Path(directory),
                budget_fractions=(1 / 3, 2 / 3, 1.0),
            )

            self.assertEqual(
                [0, 0, 0],
                compilation.model.integrality[
                    : compilation.model.primary_variable_count
                ].tolist(),
            )
            np.testing.assert_allclose(
                ranking.priority,
                np.asarray([1.0, 2 / 3, 1 / 3], dtype=np.float64),
                atol=1e-7,
            )
            self.assertEqual(np.dtype("float32"), ranking.priority.dtype)
            self.assertEqual(3, len(ranking.increment_paths))
            for path in ranking.increment_paths:
                self.assertEqual(
                    np.dtype("float32"),
                    np.load(path, mmap_mode="r", allow_pickle=False).dtype,
                )
            manifest = json.loads(
                (Path(directory) / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual("complete", manifest["status"])
            self.assertEqual("<f4", manifest["dtype"])
            self.assertEqual(3, len(ranking.diagnostics))
            for diagnostic in ranking.diagnostics:
                self.assertAlmostEqual(
                    float(diagnostic["allocation_target"]),
                    float(diagnostic["achieved_allocation"]),
                    places=6,
                )

    def test_priority_ranking_rejects_infeasible_exact_budget(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([1.0, 0.5]),
            constraints=[
                SparseConstraintSpecification(
                    "maximum_area",
                    np.arange(2, dtype=np.int32),
                    np.ones(2, dtype=np.float64),
                    [(None, 1.5)],
                )
            ],
            decision_domain="continuous",
            preserve_primary_domain=True,
            allocation_target_row=True,
        )

        with TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "Priority ranking solve failed"):
                solve_priority_ranking(
                    compilation.model,
                    configuration=SolveConfiguration(),
                    work_directory=Path(directory),
                    budget_fractions=(1.0,),
                )

    def test_objective_warm_start_provides_nonzero_feasible_incumbent(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=3,
            fused_objective=np.asarray([0.9, -0.5, 0.2]),
            constraints=[
                SparseConstraintSpecification(
                    "retain_seed_shape",
                    np.asarray([1], dtype=np.int32),
                    np.asarray([1.0]),
                    [(0.0, None)],
                )
            ],
        )
        warm_start = build_objective_warm_start(compilation.model)
        self.assertIsNotNone(warm_start)
        np.testing.assert_array_equal(
            np.asarray(warm_start), np.asarray([1.0, 0.0, 1.0])
        )

    def test_solver_defaults_to_all_process_available_cpus(self) -> None:
        """Expose the resolved process CPU count in solver result metadata."""
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([1.0, 0.5]),
            constraints=[],
        )
        result = solve_with_highs(compilation.model)
        self.assertEqual(
            available_cpu_count(),
            result.solver_settings["thread_count"],
        )
        self.assertEqual(
            "process_available_cpus",
            result.solver_settings["thread_count_source"],
        )
        self.assertEqual("choose", result.solver_settings["parallel"])
        self.assertEqual(2, result.diagnostics["original_model"]["columns"])
        self.assertIn("columns", result.diagnostics["presolved_model"])

    def test_domain_presolve_keeps_cells_that_can_satisfy_a_lower_bound(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=1,
            fused_objective=np.asarray([-1.0]),
            constraints=[
                SparseConstraintSpecification(
                    "required_habitat",
                    np.asarray([0], dtype=np.int32),
                    np.asarray([1.0]),
                    [(0.5, None)],
                )
            ],
        )

        self.assertEqual(1, compilation.model.primary_variable_count)
        self.assertEqual(
            0, compilation.reconstruction.reduction.fixed_out_planning_units
        )

    def test_objective_warm_start_respects_aggregate_resource_cap(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=3,
            fused_objective=np.asarray([0.9, 0.8, 0.2]),
            constraints=[
                SparseConstraintSpecification(
                    "cost/value",
                    np.arange(3, dtype=np.int32),
                    np.asarray([4.0, 3.0, 1.0]),
                    [(None, 5.0)],
                )
            ],
        )
        warm_start = build_objective_warm_start(compilation.model)
        self.assertIsNotNone(warm_start)
        self.assertGreater(np.count_nonzero(np.asarray(warm_start) >= 0.5), 0)
        self.assertLessEqual(
            float(
                np.dot(
                    compilation.model.coefficients,
                    np.asarray(warm_start)[compilation.model.column_indices],
                )
            ),
            5.0,
        )

    def test_zero_columns_without_highs_primal_are_not_an_incumbent(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([1.0, 0.5]),
            constraints=[],
        )
        with HighsModelSession(compilation.model) as session:
            columns = np.zeros(compilation.model.variable_count, dtype=np.float64)
            solution = SimpleNamespace(value_valid=False)
            info = SimpleNamespace(
                primal_solution_status=0,
                objective_function_value=np.inf,
            )
            self.assertTrue(session._is_feasible_incumbent(columns))
            self.assertFalse(
                session._has_certified_feasible_incumbent(
                    solution,
                    info,
                    columns,
                )
            )

    def test_deadline_returns_independently_validated_warm_start(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([1.0, -0.5]),
            constraints=[
                SparseConstraintSpecification(
                    "retain_seed_shape",
                    np.asarray([1], dtype=np.int32),
                    np.asarray([1.0]),
                    [(0.0, None)],
                )
            ],
        )
        warm_start = build_objective_warm_start(compilation.model)
        self.assertIsNotNone(warm_start)
        session = HighsModelSession(compilation.model)
        session.apply_warm_start(
            np.asarray(warm_start),
            retain_as_deadline_fallback=True,
        )
        session._solver.clear()
        session._solver = _TimeLimitedSolverWithoutIncumbent()
        with session:
            result = session.solve()
        self.assertEqual("feasible", result.status)
        self.assertEqual([1.0, 0.0], result.decisions.tolist())
        self.assertEqual(1.0, result.objective_value)
        self.assertTrue(result.solver_settings["deadline_fallback_used"])

    def test_top_k_scale_uses_positive_canonical_contributions(self) -> None:
        values = np.asarray([100.0, 10.0, 1.0, 0.0, -500.0, np.nan])
        self.assertEqual(110.0, top_k_attainable_scale(values, 2))

    def test_importance_and_direction_are_applied_after_normalization(self) -> None:
        normalization = resolve_objective_normalization(
            layer="cutblocks/value",
            direction="minimize",
            importance=27,
            attainable_scale=500_000,
            selection_count=100,
        )
        self.assertEqual("top_k_attainable", normalization.normalization_method)
        self.assertEqual(500_000, normalization.normalization_scale)
        self.assertAlmostEqual(-0.000054, normalization.resolved_coefficient)
        self.assertEqual("active", normalization.status)

    def test_zero_scale_objective_is_explicitly_degenerate(self) -> None:
        normalization = resolve_objective_normalization(
            layer="empty/value",
            direction="maximize",
            importance=50,
            attainable_scale=0,
            selection_count=100,
        )
        self.assertEqual(0, normalization.resolved_coefficient)
        self.assertEqual("degenerate", normalization.status)

    def test_constraint_coefficients_remain_in_canonical_units(self) -> None:
        canonical = np.asarray([100.0, 10.0])
        normalization = resolve_objective_normalization(
            layer="financial/cost",
            direction="minimize",
            importance=25,
            attainable_scale=110,
            selection_count=2,
        )
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=normalization.resolved_coefficient * canonical,
            constraints=[
                SparseConstraintSpecification(
                    "financial/cost",
                    np.arange(2, dtype=np.int32),
                    canonical,
                    [(50.0, None)],
                )
            ],
        )
        self.assertEqual(canonical.tolist(), compilation.model.coefficients.tolist())

    def test_compiled_artifact_retains_canonical_objective_arrays(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.asarray([0.5, 0.25]),
            constraints=[],
        )
        with TemporaryDirectory() as directory:
            write_compiled_artifact(
                compilation.model,
                Path(directory),
                problem_definition_hash="problem",
                candidate_planning_unit_ids=np.asarray([1, 2], dtype=np.uint64),
                additional_arrays={
                    "canonical_objective_0_indices": np.asarray([0, 1], dtype=np.int32),
                    "canonical_objective_0_values": np.asarray(
                        [100.0, 50.0], dtype=np.float64
                    ),
                },
            )
            loaded = load_compiled_artifact(directory)
            self.assertEqual(
                [100.0, 50.0],
                loaded.arrays["canonical_objective_0_values"].tolist(),
            )


if __name__ == "__main__":
    unittest.main()
