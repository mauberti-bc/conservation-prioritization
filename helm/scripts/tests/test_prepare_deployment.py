"""Exercise deployment recovery using fake cluster/registry clients, without live mutations."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-deployment.sh"
REPOSITORY = "registry.example/tools"
OLD_IMAGE = f"{REPOSITORY}/database:deleted"
NEW_IMAGE = f"{REPOSITORY}/database:release-sha"

FAKE_CLIENT = """#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys

command = Path(sys.argv[0]).name
args = sys.argv[1:]
state = json.loads(Path(os.environ["FAKE_STATE"]).read_text())
log = Path(os.environ["FAKE_LOG"])
with log.open("a") as output:
    output.write(json.dumps([command, *args]) + "\\n")

if command == "sleep":
    sys.exit(0)
if command == "helm" and args[0] == "list":
    if state.get("helm_error"):
        sys.exit(1)
    print(json.dumps(state["releases"]))
elif command == "oc" and args[:2] == ["get", "--raw=/readyz"]:
    calls = [json.loads(line) for line in log.read_text().splitlines()]
    attempts = sum(call[:3] == ["oc", "get", "--raw=/readyz"] for call in calls)
    if attempts <= state.get("api_failures", 0):
        sys.exit(1)
    print("ok")
elif command == "oc" and args[:2] == ["registry", "login"]:
    config = next(arg.split("=", 1)[1] for arg in args if arg.startswith("--to="))
    # Match oc: an existing --to file must contain valid registry configuration.
    credentials = json.loads(Path(config).read_text())
    assert credentials == {"auths": {}}
    Path(config).write_text(json.dumps({"auths": {"registry.example": {"auth": "test-only"}}}))
elif command == "oc" and args[:2] == ["image", "info"]:
    if args[2] == state.get("missing_image"):
        print("manifest unknown", file=sys.stderr)
        sys.exit(1)
elif command == "oc" and args[:2] == ["get", "deployment"]:
    if state.get("database_error"):
        sys.exit(1)
    if state["database"] is not None:
        print(json.dumps(state["database"]))
elif command == "oc" and args[:2] == ["get", "pods"]:
    print(json.dumps(state["pods"]))
elif command == "oc" and args[:2] == ["set", "image"]:
    if state.get("patch_error"):
        sys.exit(1)
elif command == "oc" and args[:2] == ["rollout", "status"]:
    sys.exit(state.get("rollout_exit", 0))
else:
    print(f"Unexpected command: {command} {args}", file=sys.stderr)
    sys.exit(2)
"""


class PrepareDeploymentTest(unittest.TestCase):
    def setUp(self) -> None:
        """Create isolated fake clients and a database with a deleted image."""
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.log = self.root / "calls.jsonl"
        self.state_path = self.root / "state.json"
        for command in ("oc", "helm", "sleep"):
            path = self.root / command
            path.write_text(FAKE_CLIENT)
            path.chmod(0o700)
        self.state = {
            "releases": [{"name": "conservation-tool", "status": "failed"}],
            "database": {
                "spec": {
                    "template": {
                        "spec": {
                            "containers": [{"name": "postgresql", "image": OLD_IMAGE}]
                        }
                    }
                },
                "status": {"readyReplicas": 0},
            },
            "pods": {
                "items": [
                    {
                        "status": {
                            "containerStatuses": [
                                {
                                    "name": "postgresql",
                                    "image": OLD_IMAGE,
                                    "state": {
                                        "waiting": {"reason": "ImagePullBackOff"}
                                    },
                                }
                            ]
                        }
                    }
                ]
            },
        }

    def run_preflight(self, tag: str = "release-sha") -> subprocess.CompletedProcess:
        """Run the real shell script against the configured fake cluster."""
        self.state_path.write_text(json.dumps(self.state))
        result = subprocess.run(
            ["bash", str(SCRIPT), "test-dev", REPOSITORY, tag],
            env={
                **os.environ,
                "PATH": f"{self.root}{os.pathsep}{os.environ['PATH']}",
                "FAKE_STATE": str(self.state_path),
                "FAKE_LOG": str(self.log),
            },
            text=True,
            capture_output=True,
            timeout=20,
        )
        self.calls = (
            [json.loads(line) for line in self.log.read_text().splitlines()]
            if self.log.exists()
            else []
        )
        # Registry credentials must be removed on both successful and failed runs.
        for call in self.calls:
            if call[:3] == ["oc", "registry", "login"]:
                config = next(
                    arg.split("=", 1)[1] for arg in call if arg.startswith("--to=")
                )
                self.assertFalse(Path(config).exists())
        return result

    def test_missing_database_image_is_recovered_after_all_images_are_verified(
        self,
    ) -> None:
        """Recover the incident's deleted image without changing any other database settings."""
        result = self.run_preflight()
        self.assertEqual(0, result.returncode, result.stderr)
        image_checks = [
            call for call in self.calls if call[:3] == ["oc", "image", "info"]
        ]
        self.assertEqual(
            {
                f"{REPOSITORY}/{name}:release-sha"
                for name in (
                    "frontend",
                    "api",
                    "database",
                    "db-setup",
                    "prefect-worker",
                    "prefect-deploy",
                )
            },
            {call[3] for call in image_checks},
        )
        patch = next(call for call in self.calls if call[:3] == ["oc", "set", "image"])
        self.assertIn(f"postgresql={NEW_IMAGE}", patch)
        self.assertGreater(
            self.calls.index(patch),
            max(self.calls.index(call) for call in image_checks),
        )
        self.assertEqual(["oc", "rollout", "status"], self.calls[-1][:3])

    def test_incomplete_release_cannot_change_the_database(self) -> None:
        """A missing final image blocks recovery even when the database needs repair."""
        self.state["missing_image"] = f"{REPOSITORY}/prefect-deploy:release-sha"
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertIn("Rebuild the complete release", result.stderr)
        self.assertFalse(any(call[:3] == ["oc", "set", "image"] for call in self.calls))

    def test_pending_operations_are_preserved(self) -> None:
        """Never repair workloads or delete Helm records while an operation is pending."""
        for status in ("pending-install", "pending-upgrade", "pending-rollback"):
            with self.subTest(status=status):
                self.state["releases"][0]["status"] = status
                result = self.run_preflight()
                self.assertNotEqual(0, result.returncode)
                self.assertIn(status, result.stderr)
                self.assertTrue(all(call[1] in ("get", "list") for call in self.calls))

    def test_healthy_database_keeps_its_current_image(self) -> None:
        """A normal upgrade leaves database image changes to Helm."""
        self.state["database"]["status"]["readyReplicas"] = 1
        result = self.run_preflight()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse(any(call[:3] == ["oc", "set", "image"] for call in self.calls))
        self.assertEqual(["oc", "rollout", "status"], self.calls[-1][:3])

    def test_database_crash_is_not_treated_as_an_image_failure(self) -> None:
        """Fail readiness instead of replacing the image for unrelated PostgreSQL errors."""
        self.state["pods"]["items"][0]["status"]["containerStatuses"][0]["state"][
            "waiting"
        ]["reason"] = "CrashLoopBackOff"
        self.state["rollout_exit"] = 1
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any(call[:3] == ["oc", "set", "image"] for call in self.calls))

    def test_first_install_allows_helm_to_create_the_database(self) -> None:
        """Fresh installations retain the chart's post-install migration ordering."""
        self.state["releases"] = []
        self.state["database"] = None
        result = self.run_preflight()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse(any(call[1] in ("set", "rollout") for call in self.calls))

    def test_missing_database_in_existing_release_blocks_migrations(self) -> None:
        """A deleted Deployment requires recovery rather than a doomed pre-upgrade hook."""
        self.state["database"] = None
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertIn("missing its database Deployment", result.stderr)

    def test_transient_api_failure_is_retried(self) -> None:
        """A brief connection failure can recover without repeating cluster mutations."""
        self.state["api_failures"] = 1
        result = self.run_preflight()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            2, sum(call[:3] == ["oc", "get", "--raw=/readyz"] for call in self.calls)
        )
        self.assertEqual(
            1, sum(call[:3] == ["oc", "set", "image"] for call in self.calls)
        )

    def test_persistent_api_failure_stops_before_cluster_changes(self) -> None:
        """Exhausted connectivity retries must not be mistaken for an empty cluster."""
        self.state["api_failures"] = 3
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any(call[0] == "helm" for call in self.calls))

    def test_failed_helm_query_is_not_treated_as_a_first_install(self) -> None:
        """An unavailable Helm history cannot authorize database recovery."""
        self.state["helm_error"] = True
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any(call[:3] == ["oc", "set", "image"] for call in self.calls))

    def test_database_read_error_is_not_treated_as_absence(self) -> None:
        """Read errors stop preflight instead of letting migrations proceed."""
        self.state["database_error"] = True
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any(call[1] in ("set", "rollout") for call in self.calls))

    def test_failed_image_update_stops_before_readiness(self) -> None:
        """Do not continue after a failed recovery mutation."""
        self.state["patch_error"] = True
        result = self.run_preflight()
        self.assertNotEqual(0, result.returncode)
        self.assertFalse(any(call[1] == "rollout" for call in self.calls))

    def test_invalid_image_tag_stops_before_any_cluster_access(self) -> None:
        """Reject malformed tag input before executing cluster commands."""
        result = self.run_preflight("invalid tag")
        self.assertNotEqual(0, result.returncode)
        self.assertEqual([], self.calls)
