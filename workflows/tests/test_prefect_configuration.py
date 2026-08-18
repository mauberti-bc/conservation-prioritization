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
        worker_values = helm_values["services"]["workflows"]["worker"]
        self.assertEqual(
            deployment_pools,
            {profile["pool"] for profile in helm_profiles.values()},
        )
        self.assertEqual("ReadWriteOnce", worker_values["persistence"]["accessMode"])
        self.assertEqual("512Mi", worker_values["persistence"]["size"])
        sparse_profile = helm_profiles["sparse-solver"]
        self.assertEqual("sparse-16g", sparse_profile["executionProfile"])
        self.assertEqual(1, sparse_profile["daskWorkers"])
        self.assertEqual(
            sparse_profile["resources"]["limits"]["memory"],
            sparse_profile["daskWorkerMemory"],
        )
        self.assertEqual(12 * 1024**3, sparse_profile["maxPeakMemoryBytes"])
        self.assertEqual(512 * 1024**2, sparse_profile["maxScratchBytes"])
        self.assertEqual("16Gi", sparse_profile["resources"]["limits"]["memory"])
        self.assertIn(
            "536870912",
            str(
                compose["services"]["prefect_worker"]["environment"][
                    "WORKFLOW_SCRATCH_LIMIT_BYTES"
                ]
            ),
        )

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

    def test_worker_init_syncs_prefect_deployments(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        worker_deployment = (
            repository
            / "helm"
            / "conservation-tool"
            / "templates"
            / "workflows"
            / "worker-deployment.yaml"
        ).read_text(encoding="utf-8")

        self.assertIn("sync-prefect-deployments", worker_deployment)
        self.assertIn("- src/setup.sh", worker_deployment)
        self.assertNotIn("- src/ensure_work_pool.sh", worker_deployment)
        self.assertIn("WORKFLOW_SCRATCH_ROOT", worker_deployment)
        self.assertIn("WORKFLOW_SCRATCH_LIMIT_BYTES", worker_deployment)
        self.assertIn("mountPath:", worker_deployment)
        self.assertIn("/workflow-scratch", worker_deployment)
        self.assertIn("persistentVolumeClaim:", worker_deployment)
        self.assertIn("conservation-tool.fullname.workflow-scratch", worker_deployment)
        self.assertIn("fsGroup:", worker_deployment)
        self.assertIn("type: Recreate", worker_deployment)

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

        task_tile_source = (
            repository / "workflows" / "src" / "flows" / "task_tile.py"
        ).read_text(encoding="utf-8")
        self.assertIn(
            'os.getenv("SPATIAL_DASK_WORKER_MEMORY", "4GB")',
            task_tile_source,
        )

    def test_workflows_use_durable_scratch_for_outputs(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        optimization_source = (
            repository / "workflows" / "src" / "flows" / "optimization_execution.py"
        ).read_text(encoding="utf-8")
        task_tile_source = (
            repository / "workflows" / "src" / "flows" / "task_tile.py"
        ).read_text(encoding="utf-8")
        scratch_source = (
            repository / "workflows" / "src" / "utils" / "scratch.py"
        ).read_text(encoding="utf-8")

        self.assertIn("task_run_scratch_directory", optimization_source)
        self.assertIn("task_run_scratch_directory", task_tile_source)
        self.assertIn("cleanup_scratch_directory(output_dir)", optimization_source)
        self.assertIn("cleanup_scratch_directory(output)", task_tile_source)
        self.assertIn(
            'DEFAULT_WORKFLOW_SCRATCH_ROOT = "/workflow-scratch"',
            scratch_source,
        )
        self.assertIn("WORKFLOW_KEEP_SCRATCH", scratch_source)
        self.assertNotIn('Path("/data/outputs")', optimization_source)
        self.assertNotIn('Path("/data/outputs")', task_tile_source)

    def test_workflow_scratch_pvc_is_declared(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        pvc_template = (
            repository
            / "helm"
            / "conservation-tool"
            / "templates"
            / "workflows"
            / "scratch-pvc.yaml"
        ).read_text(encoding="utf-8")

        self.assertIn("kind: PersistentVolumeClaim", pvc_template)
        self.assertIn("services.workflows.worker.persistence.enabled", pvc_template)
        self.assertIn('default "ReadWriteOnce"', pvc_template)
        self.assertIn("conservation-tool.fullname.workflow-scratch", pvc_template)

    def test_internal_workflow_callbacks_do_not_return_full_runs(self) -> None:
        repository = Path(__file__).resolve().parents[2]
        callback_paths = [
            repository
            / "api"
            / "src"
            / "paths"
            / "internal"
            / "run"
            / "{runId}"
            / "artifact"
            / "{artifactType}"
            / "index.ts",
            repository
            / "api"
            / "src"
            / "paths"
            / "internal"
            / "run"
            / "{runId}"
            / "status"
            / "index.ts",
            repository
            / "api"
            / "src"
            / "paths"
            / "internal"
            / "run"
            / "{runId}"
            / "solution"
            / "index.ts",
            repository
            / "api"
            / "src"
            / "paths"
            / "internal"
            / "run"
            / "{runId}"
            / "publish"
            / "index.ts",
        ]

        for path in callback_paths:
            source = path.read_text(encoding="utf-8")
            self.assertIn("json({ ok: true })", source)
            self.assertNotIn("TaskRunSchema", source)

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
