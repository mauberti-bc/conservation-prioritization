"""Empty models use the Infeasible run outcome without publishing results."""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np

from src.flows.optimization_execution import (
    _solve_compiled_model,
    execute_optimization_run,
)
from src.optimization.compiler import (
    SparseConstraintSpecification,
    compile_spatial_optimization,
)
from src.optimization.highs import HighsModelSession


class EmptyModelTests(unittest.TestCase):
    """Exercise actual empty HiGHS models through the execution flow."""

    def test_empty_models_finish_infeasible_without_publication(self):
        """Empty models never complete with results, even if constraints permit zero."""
        module = "src.flows.optimization_execution"
        for domain in ("continuous", "discrete"):
            for mode in ("standard", "exact_audit"):
                for minimum in (None, 1.0):
                    with (
                        self.subTest(domain=domain, mode=mode, minimum=minimum),
                        TemporaryDirectory() as directory,
                    ):
                        constraints = (
                            []
                            if minimum is None
                            else [
                                SparseConstraintSpecification(
                                    "zero_layer",
                                    np.arange(2, dtype=np.int32),
                                    np.zeros(2),
                                    [(minimum, None)],
                                )
                            ]
                        )
                        compilation = compile_spatial_optimization(
                            planning_units=None,
                            planning_unit_count=2,
                            fused_objective=np.zeros(2),
                            constraints=constraints,
                            decision_domain=domain,
                        )
                        self.assertEqual(compilation.model.variable_count, 0)
                        run = {
                            "task_type": f"{domain}_optimization",
                            "execution_method": f"compiled_{domain}_optimization",
                            "input_snapshot": {"optimization_mode": mode},
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
                                f"{module}.task_run_scratch_directory",
                                return_value=Path(directory),
                            ),
                            patch(f"{module}.cleanup_scratch_directory"),
                            patch(f"{module}.update_run") as update,
                            patch(f"{module}.update_artifact") as update_artifact,
                            patch(
                                f"{module}.load_compiled_artifact",
                                return_value=SimpleNamespace(model=compilation.model),
                            ),
                            patch(f"{module}.acquire_task_run_slot"),
                            patch(
                                f"{module}._solve_compiled_model",
                                side_effect=_solve_compiled_model.fn,
                            ),
                            patch(f"{module}.internal_api_request") as publish,
                            patch(
                                f"{module}._reconstruct_source_decisions"
                            ) as reconstruct,
                        ):
                            execute_optimization_run(
                                "run-id",
                                expected_task_type=run["task_type"],
                                expected_execution_method=run["execution_method"],
                                decision_domain=domain,
                                compile_run=MagicMock(return_value=prepared),
                            )
                        self.assertEqual(
                            update.call_args.kwargs["status"], "infeasible"
                        )
                        self.assertEqual(
                            update.call_args.kwargs["solver_status"], "empty"
                        )
                        self.assertIsNone(update.call_args.kwargs["failure_code"])
                        self.assertFalse(
                            any(
                                call.kwargs.get("status") in ("failed", "completed")
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

    def test_missing_native_model_remains_an_error(self):
        """A transfer error must not be mistaken for a legitimately empty model."""
        compilation = compile_spatial_optimization(
            planning_units=None,
            planning_unit_count=2,
            fused_objective=np.ones(2),
            constraints=[],
            preserve_primary_domain=True,
        )
        with HighsModelSession(compilation.model) as session:
            session._solver.clearModel()
            with self.assertRaisesRegex(RuntimeError, "nonempty or incomplete"):
                session.solve()
