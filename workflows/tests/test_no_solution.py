import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np

from src.optimization.compiler import (
    SparseConstraintSpecification,
    compile_spatial_optimization,
)
from src.optimization.highs import NoFeasibleSolutionError, require_acceptable_result
from src.optimization.model import SolveConfiguration
from src.flows.optimization_execution import (
    InfeasibleRunOutcome,
    execute_optimization_run,
    execute_priority_ranking_run,
    _solve_compiled_model,
    _solve_priority_ranking_model,
)


class NoSolutionTests(unittest.TestCase):
    def test_infeasibility_is_distinct_from_solver_errors(self):
        for mode in ("standard", "exact_audit"):
            result = SimpleNamespace(status="infeasible", runtime_seconds=1.0)
            with self.assertRaises(NoFeasibleSolutionError) as caught:
                require_acceptable_result(result, SolveConfiguration(mode=mode))
            self.assertIs(caught.exception.result, result)
        for mode in ("standard", "exact_audit"):
            for status in (
                "solve_error",
                "time_limit",
                "unbounded_or_infeasible",
                "unbounded",
            ):
                with self.subTest(mode=mode, status=status):
                    with self.assertRaises(RuntimeError) as caught:
                        require_acceptable_result(
                            SimpleNamespace(status=status, optimality_gap=None),
                            SolveConfiguration(mode=mode),
                        )
                    self.assertNotIsInstance(caught.exception, NoFeasibleSolutionError)

    def test_infeasible_run_completes_without_publication(self):
        module = "src.flows.optimization_execution"
        with TemporaryDirectory() as directory:
            run = {
                "task_type": "discrete_optimization",
                "execution_method": "compiled_discrete_optimization",
                "input_snapshot": {},
                "planning_unit_definition": {},
            }
            prepared = SimpleNamespace(
                preparation_directory=directory,
                preparation_manifest={},
                canonical_path=str(Path(directory) / "canonical.zarr"),
            )
            result = SimpleNamespace(status="infeasible", runtime_seconds=1.0)
            with (
                patch(f"{module}.resolve_run", return_value=run),
                patch(f"{module}.get_run_logger"),
                patch(f"{module}.flow_run"),
                patch(
                    f"{module}.task_run_scratch_directory", return_value=Path(directory)
                ),
                patch(f"{module}.cleanup_scratch_directory"),
                patch(f"{module}.update_run") as update,
                patch(f"{module}.update_artifact"),
                patch(
                    f"{module}._solve_compiled_model",
                    return_value=InfeasibleRunOutcome(result.runtime_seconds),
                ),
                patch(f"{module}.internal_api_request") as publish,
            ):
                execute_optimization_run(
                    "run-id",
                    expected_task_type="discrete_optimization",
                    expected_execution_method="compiled_discrete_optimization",
                    decision_domain="discrete",
                    compile_run=MagicMock(return_value=prepared),
                )
            self.assertEqual(update.call_args.kwargs["status"], "infeasible")
            self.assertEqual(update.call_args.kwargs["solver_status"], "infeasible")
            publish.assert_not_called()

    def test_priority_infeasibility_skips_publication(self):
        module = "src.flows.optimization_execution"
        with TemporaryDirectory() as directory:
            run = {
                "task_type": "priority_ranking",
                "execution_method": "compiled_priority_ranking",
                "input_snapshot": {},
                "planning_unit_definition": {},
            }
            prepared = SimpleNamespace(
                preparation_directory=directory,
                preparation_manifest={},
                canonical_path=str(Path(directory) / "canonical.zarr"),
            )
            with (
                patch(f"{module}.resolve_run", return_value=run),
                patch(f"{module}.get_run_logger"),
                patch(f"{module}.flow_run"),
                patch(
                    f"{module}.task_run_scratch_directory", return_value=Path(directory)
                ),
                patch(f"{module}.cleanup_scratch_directory"),
                patch(f"{module}.update_run") as update,
                patch(f"{module}.update_artifact"),
                patch(
                    f"{module}._solve_priority_ranking_model",
                    return_value=InfeasibleRunOutcome(1.0),
                ),
                patch(f"{module}.internal_api_request") as publish,
            ):
                execute_priority_ranking_run(
                    "run-id", compile_run=MagicMock(return_value=prepared)
                )
            self.assertEqual(update.call_args.kwargs["status"], "infeasible")
            publish.assert_not_called()

    def test_solve_tasks_return_infeasibility_without_raising(self):
        module = "src.flows.optimization_execution"
        for status in ("infeasible", "empty"):
            result = SimpleNamespace(status=status, runtime_seconds=1.0)
            for solve_task in (_solve_compiled_model, _solve_priority_ranking_model):
                with (
                    self.subTest(task=solve_task.name, status=status),
                    TemporaryDirectory() as directory,
                ):
                    artifact = MagicMock()
                    artifact.manifest.fixed_in_count = 0
                    artifact.manifest.fixed_out_count = 0
                    with (
                        patch(f"{module}.get_run_logger"),
                        patch(
                            f"{module}.load_compiled_artifact", return_value=artifact
                        ),
                        patch(f"{module}.acquire_task_run_slot"),
                        patch(f"{module}.solve_with_highs", return_value=result),
                        patch(
                            f"{module}.solve_priority_ranking",
                            side_effect=NoFeasibleSolutionError(result),
                        ),
                        patch(f"{module}._reconstruct_source_decisions") as reconstruct,
                    ):
                        kwargs = (
                            {"decision_domain": "discrete"}
                            if solve_task is _solve_compiled_model
                            else {}
                        )
                        outcome = solve_task.fn(
                            "run-id",
                            {},
                            {},
                            Path(directory),
                            Path(directory),
                            Path(directory),
                            {},
                            **kwargs,
                        )
                    self.assertEqual(outcome, InfeasibleRunOutcome(1.0, status))
                    reconstruct.assert_not_called()

    def test_real_solver_infeasibility_reaches_terminal_outcome_for_every_flow(self):
        """Exercise actual HiGHS solves through task bodies and flow orchestration."""
        module = "src.flows.optimization_execution"
        for task_type in (
            "continuous_optimization",
            "discrete_optimization",
            "priority_ranking",
        ):
            for mode in ("standard", "exact_audit"):
                with (
                    self.subTest(task_type=task_type, mode=mode),
                    TemporaryDirectory() as directory,
                ):
                    priority = task_type == "priority_ranking"
                    domain = (
                        "discrete"
                        if task_type == "discrete_optimization"
                        else "continuous"
                    )
                    constraints = [
                        SparseConstraintSpecification(
                            "maximum_area",
                            np.arange(2, dtype=np.int32),
                            np.ones(2),
                            [(None, 1.5 if priority else 0.5)],
                        )
                    ]
                    if not priority:
                        constraints.append(
                            SparseConstraintSpecification(
                                "minimum_area",
                                np.arange(2, dtype=np.int32),
                                np.ones(2),
                                [(1.5, None)],
                            )
                        )
                    compilation = compile_spatial_optimization(
                        planning_units=None,
                        planning_unit_count=2,
                        fused_objective=np.asarray([1.0, 0.5]),
                        constraints=constraints,
                        decision_domain=domain,
                        preserve_primary_domain=True,
                        allocation_target_row=priority,
                    )
                    artifact = SimpleNamespace(
                        model=compilation.model,
                        manifest=SimpleNamespace(fixed_in_count=0, fixed_out_count=0),
                    )
                    run = {
                        "task_type": task_type,
                        "execution_method": f"compiled_{task_type}",
                        "input_snapshot": {"optimization_mode": mode},
                        "planning_unit_definition": {},
                    }
                    prepared = SimpleNamespace(
                        preparation_directory=directory,
                        preparation_manifest={},
                        canonical_path=str(Path(directory) / "canonical.zarr"),
                    )
                    solve_task = (
                        _solve_priority_ranking_model
                        if priority
                        else _solve_compiled_model
                    )
                    with (
                        patch(f"{module}.resolve_run", return_value=run),
                        patch(f"{module}.get_run_logger"),
                        patch(f"{module}.flow_run"),
                        patch(
                            f"{module}.task_run_scratch_directory",
                            return_value=Path(directory),
                        ),
                        patch(f"{module}.cleanup_scratch_directory"),
                        patch(f"{module}.update_run") as update,
                        patch(f"{module}.update_artifact") as update_artifact,
                        patch(
                            f"{module}.load_compiled_artifact", return_value=artifact
                        ),
                        patch(f"{module}.acquire_task_run_slot"),
                        patch(
                            f"{module}.{solve_task.fn.__name__}",
                            side_effect=solve_task.fn,
                        ),
                        patch(f"{module}.internal_api_request") as publish,
                        patch(f"{module}._reconstruct_source_decisions") as reconstruct,
                    ):
                        if priority:
                            execute_priority_ranking_run(
                                "run-id", compile_run=MagicMock(return_value=prepared)
                            )
                        else:
                            execute_optimization_run(
                                "run-id",
                                expected_task_type=task_type,
                                expected_execution_method=run["execution_method"],
                                decision_domain=domain,
                                compile_run=MagicMock(return_value=prepared),
                            )
                    self.assertEqual(update.call_args.kwargs["status"], "infeasible")
                    self.assertEqual(
                        update.call_args.kwargs["solver_status"], "infeasible"
                    )
                    self.assertIsNone(update.call_args.kwargs["failure_code"])
                    self.assertFalse(
                        any(
                            call.kwargs.get("status") == "failed"
                            for call in update.call_args_list
                        )
                    )
                    self.assertFalse(
                        any(
                            call.kwargs.get("status") == "failed"
                            for call in update_artifact.call_args_list
                        )
                    )
                    publish.assert_not_called()
                    reconstruct.assert_not_called()
