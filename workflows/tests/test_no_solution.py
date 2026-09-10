import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from pathlib import Path
from tempfile import TemporaryDirectory

from src.optimization.highs import NoFeasibleSolutionError, require_acceptable_result
from src.optimization.model import SolveConfiguration
from src.flows.optimization_execution import execute_optimization_run


class NoSolutionTests(unittest.TestCase):
    def test_infeasibility_is_distinct_from_solver_errors(self):
        for mode in ("standard", "exact_audit"):
            result = SimpleNamespace(status="infeasible", runtime_seconds=1.0)
            with self.assertRaises(NoFeasibleSolutionError) as caught:
                require_acceptable_result(result, SolveConfiguration(mode=mode))
            self.assertIs(caught.exception.result, result)
        with self.assertRaises(RuntimeError) as caught:
            require_acceptable_result(
                SimpleNamespace(status="solve_error"), SolveConfiguration()
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
                patch(f"{module}.task_run_scratch_directory", return_value=Path(directory)),
                patch(f"{module}.cleanup_scratch_directory"),
                patch(f"{module}.update_run") as update,
                patch(f"{module}.update_artifact"),
                patch(f"{module}._solve_compiled_model", side_effect=NoFeasibleSolutionError(result)),
                patch(f"{module}.internal_api_request") as publish,
            ):
                execute_optimization_run(
                    "run-id",
                    expected_task_type="discrete_optimization",
                    expected_execution_method="compiled_discrete_optimization",
                    decision_domain="discrete",
                    compile_run=MagicMock(return_value=prepared),
                )
            self.assertEqual(update.call_args.kwargs["status"], "completed")
            self.assertEqual(update.call_args.kwargs["solver_status"], "infeasible")
            publish.assert_not_called()
