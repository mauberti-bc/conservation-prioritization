import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

from src.utils.task_run_concurrency import (
    TASK_RUN_CONCURRENCY_LIMIT,
    TASK_RUN_LEASE_DURATION_SECONDS,
    acquire_task_run_slot,
)


class PrefectConfigurationTest(unittest.TestCase):
    def test_continuous_and_discrete_optimization_are_deployed(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        configuration = yaml.safe_load(
            (repository / "workflows" / "prefect.yaml").read_text(encoding="utf-8")
        )
        deployments = {
            deployment["name"] for deployment in configuration["deployments"]
        }
        self.assertIn("task-run-continuous-optimization-compiled", deployments)
        self.assertIn("task-run-discrete-optimization-compiled", deployments)
        self.assertIn("task-run-priority-ranking-compiled", deployments)

    def test_deployment_pools_are_created_and_have_compose_workers(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        workflow_configuration = yaml.safe_load(
            (repository / "workflows" / "prefect.yaml").read_text(encoding="utf-8")
        )
        deployment_pools = {
            deployment["work_pool"]["name"]
            for deployment in workflow_configuration["deployments"]
        }
        setup_script = (repository / "workflows" / "src" / "setup.sh").read_text(
            encoding="utf-8"
        )
        for pool in deployment_pools:
            self.assertIn(f'"{pool}"', setup_script)

        compose = yaml.safe_load(
            (repository / "compose.yml").read_text(encoding="utf-8")
        )
        compose_worker_pools = {
            service["command"][-1]
            for name, service in compose["services"].items()
            if name.startswith("prefect_worker")
        }
        self.assertEqual(deployment_pools, compose_worker_pools)

        helm_values = yaml.safe_load(
            (repository / "helm" / "conservation-tool" / "values.yaml").read_text(
                encoding="utf-8"
            )
        )
        helm_profiles = helm_values["services"]["workflows"]["worker"]["profiles"]
        self.assertEqual(
            deployment_pools,
            {profile["pool"] for profile in helm_profiles.values()},
        )
        sparse_profile = helm_profiles["sparse-solver"]
        self.assertEqual("sparse-32g", sparse_profile["executionProfile"])
        self.assertEqual(1, sparse_profile["daskWorkers"])
        self.assertEqual("4GB", sparse_profile["daskWorkerMemory"])
        self.assertEqual(24 * 1024**3, sparse_profile["maxPeakMemoryBytes"])
        self.assertEqual("32Gi", sparse_profile["resources"]["limits"]["memory"])

    def test_solver_concurrency_is_scoped_to_the_solver_task(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        setup_script = (repository / "workflows" / "src" / "setup.sh").read_text(
            encoding="utf-8"
        )
        pool_script = (
            repository / "workflows" / "src" / "ensure_work_pool.sh"
        ).read_text(encoding="utf-8")

        self.assertIn(
            'TASK_RUN_CONCURRENCY_LIMIT="conservation-task-runs"',
            setup_script,
        )
        self.assertIn('--limit 1 --enable', setup_script)
        self.assertIn('--limit 1', setup_script)
        self.assertIn('WORK_POOL_CONCURRENCY="${3:-1}"', pool_script)
        self.assertIn('set-concurrency-limit', pool_script)

        optimization_flow_source = (
            repository / "workflows" / "src" / "flows" / "optimization_execution.py"
        ).read_text(encoding="utf-8")
        self.assertIn('@task(name="solve_compiled_model")', optimization_flow_source)
        self.assertIn("with acquire_task_run_slot():", optimization_flow_source)

    def test_dask_compilation_closes_before_highs_starts(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        for domain in ("continuous", "discrete"):
            flow_source = (
                repository
                / "workflows"
                / "src"
                / "flows"
                / f"task_run_{domain}_optimization.py"
            ).read_text(encoding="utf-8")

            self.assertIn(f'name="compile_task_run_{domain}_optimization"', flow_source)
            self.assertIn(f'@flow(name="task_run_{domain}_optimization")', flow_source)
            self.assertIn('os.getenv("SPATIAL_DASK_WORKERS", "1")', flow_source)
            self.assertIn(
                'os.getenv("SPATIAL_DASK_WORKER_MEMORY", "4GB")', flow_source
            )
            self.assertIn(
                f"compile_run=compile_task_run_{domain}_optimization", flow_source
            )
        priority_flow_source = (
            repository
            / "workflows"
            / "src"
            / "flows"
            / "task_run_priority_ranking.py"
        ).read_text(encoding="utf-8")

        self.assertIn('name="compile_task_run_priority_ranking"', priority_flow_source)
        self.assertIn('@flow(name="task_run_priority_ranking")', priority_flow_source)
        self.assertIn('os.getenv("SPATIAL_DASK_WORKERS", "1")', priority_flow_source)
        self.assertIn(
            'os.getenv("SPATIAL_DASK_WORKER_MEMORY", "4GB")',
            priority_flow_source,
        )
        self.assertIn(
            "compile_run=compile_task_run_priority_ranking",
            priority_flow_source,
        )

    def test_task_run_slot_uses_a_short_failure_recovery_lease(self) -> None:
        with patch("src.utils.task_run_concurrency.concurrency") as concurrency:
            with acquire_task_run_slot():
                pass

        concurrency.assert_called_once_with(
            TASK_RUN_CONCURRENCY_LIMIT,
            occupy=1,
            lease_duration=TASK_RUN_LEASE_DURATION_SECONDS,
            strict=True,
        )
        self.assertEqual(60, TASK_RUN_LEASE_DURATION_SECONDS)


if __name__ == "__main__":
    unittest.main()
