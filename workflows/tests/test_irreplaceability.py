import unittest

import numpy as np

from src.optimization.compiler import (
    SparseConstraintSpecification,
    compile_spatial_optimization,
)
from src.optimization.highs import solve_with_highs
from src.optimization.irreplaceability import analyze_irreplaceability
from src.optimization.model import SolveConfiguration


class IrreplaceabilityTest(unittest.TestCase):
    def _analyze(
        self,
        values: list[float],
        *,
        target_area: int,
        constraints: list[tuple[float | None, float | None]] | None = None,
        maximum_scenarios: int | None = None,
        use_warm_starts: bool = True,
    ):
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=len(values),
            constraints=[
                SparseConstraintSpecification(
                    "habitat",
                    np.arange(len(values), dtype=np.int32),
                    np.asarray(values, dtype=np.float64),
                    constraints or [],
                ),
                SparseConstraintSpecification(
                    "selected_units",
                    np.arange(len(values), dtype=np.int32),
                    np.ones(len(values), dtype=np.float64),
                    [(None, float(target_area))],
                ),
            ],
            fused_objective=np.asarray(values, dtype=np.float64),
        )
        configuration = SolveConfiguration(mode="exact_audit")
        reference = solve_with_highs(
            compilation.model,
            configuration=configuration,
        )
        source_ids = np.arange(100, 100 + len(values))
        candidate_ids = source_ids[
            compilation.reconstruction.planning_unit_solver_columns >= 0
        ]
        return analyze_irreplaceability(
            compilation.model,
            reference,
            candidate_planning_unit_ids=candidate_ids,
            configuration=configuration,
            maximum_scenarios=maximum_scenarios,
            use_warm_starts=use_warm_starts,
        )

    def test_uniquely_essential_selected_and_unselected_units(self) -> None:
        result = self._analyze([3.0, 2.0, 1.0], target_area=1)
        costs = {
            value.planning_unit_id: value.replacement_cost_absolute
            for value in result.planning_units
        }
        self.assertEqual({100: 1.0, 101: 0.0, 102: 0.0}, costs)
        by_id = {value.planning_unit_id: value for value in result.planning_units}
        self.assertTrue(by_id[100].counterfactual_solved)
        self.assertFalse(by_id[101].counterfactual_solved)
        self.assertEqual(
            "not_solved_reference_optimum", by_id[101].counterfactual_status
        )
        self.assertEqual("replaceable", by_id[101].replacement_status)

    def test_perfect_substitutes_have_zero_replacement_cost(self) -> None:
        result = self._analyze([2.0, 2.0], target_area=1)
        self.assertEqual(
            [0.0, 0.0],
            [value.replacement_cost_absolute for value in result.planning_units],
        )

    def test_representation_target_changes_replacement_cost(self) -> None:
        result = self._analyze(
            [5.0, 3.0, 3.0],
            target_area=2,
            constraints=[(6.0, None)],
        )
        by_id = {value.planning_unit_id: value for value in result.planning_units}
        self.assertEqual(2.0, by_id[100].replacement_cost_absolute)
        self.assertEqual(0.0, by_id[102].replacement_cost_absolute)

    def test_each_exclusion_restores_the_previous_unit_bound(self) -> None:
        result = self._analyze([5.0, 4.0, 1.0], target_area=2)
        by_id = {value.planning_unit_id: value for value in result.planning_units}
        self.assertEqual(4.0, by_id[100].replacement_cost_absolute)
        self.assertEqual(3.0, by_id[101].replacement_cost_absolute)

    def test_scenario_limit_counts_only_actual_solver_executions(self) -> None:
        result = self._analyze(
            [3.0, 2.0, 1.0],
            target_area=1,
            maximum_scenarios=1,
            use_warm_starts=False,
        )
        self.assertEqual(
            1, sum(value.counterfactual_solved for value in result.planning_units)
        )
        with self.assertRaisesRegex(ValueError, "1 counterfactual solves"):
            self._analyze(
                [3.0, 2.0, 1.0],
                target_area=1,
                maximum_scenarios=0,
            )

    def test_analysis_can_be_bounded_to_requested_units(self) -> None:
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=3,
            constraints=[
                SparseConstraintSpecification(
                    "selected_units",
                    np.arange(3, dtype=np.int32),
                    np.ones(3, dtype=np.float64),
                    [(None, 1.0)],
                ),
            ],
            fused_objective=np.asarray([3.0, 2.0, 1.0]),
        )
        configuration = SolveConfiguration(mode="exact_audit")
        reference = solve_with_highs(compilation.model, configuration=configuration)
        result = analyze_irreplaceability(
            compilation.model,
            reference,
            candidate_planning_unit_ids=np.asarray([10, 11, 12]),
            requested_planning_unit_ids=np.asarray([10]),
            configuration=configuration,
        )
        self.assertEqual(
            (10,), tuple(v.planning_unit_id for v in result.planning_units)
        )

    def test_uniquely_required_unit_reports_infeasible_exclusion(self) -> None:
        result = self._analyze(
            [2.0, 0.0],
            target_area=1,
            constraints=[(2.0, None)],
        )
        essential = result.planning_units[0]
        self.assertFalse(essential.counterfactual_feasible)
        self.assertTrue(essential.counterfactual_solved)
        self.assertEqual("absolutely_irreplaceable", essential.replacement_status)
        self.assertIsNone(essential.replacement_cost_absolute)


if __name__ == "__main__":
    unittest.main()
