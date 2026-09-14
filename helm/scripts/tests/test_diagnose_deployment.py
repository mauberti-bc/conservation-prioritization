"""Collect disappearing init-container failures without changing cluster resources."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "diagnose-deployment.sh"
FAKE_CLIENT = """#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
with Path(os.environ['COMMAND_LOG']).open('a') as output:
    output.write(json.dumps([name, *args]) + '\\n')
if name == 'oc' and args[:2] == ['get', 'pods']:
    print(Path(os.environ['PODS_FILE']).read_text())
if name == 'oc' and args[:1] == ['logs']:
    sys.exit(1)  # A deleted pod must not stop collection for other containers.
"""


class DeploymentDiagnosticsTests(unittest.TestCase):
    def test_collects_current_and_previous_failed_container_logs(self):
        """Retain init-container errors and continue if a pod disappears mid-query."""
        pods = {
            "items": [
                {
                    "metadata": {"name": "conservation-tool-prefect-worker-abc"},
                    "status": {
                        "initContainerStatuses": [
                            {
                                "name": "sync-prefect-deployments",
                                "restartCount": 3,
                                "state": {"waiting": {"reason": "CrashLoopBackOff"}},
                            }
                        ],
                        "containerStatuses": [
                            {
                                "name": "prefect-worker",
                                "restartCount": 0,
                                "state": {"waiting": {"reason": "PodInitializing"}},
                            }
                        ],
                    },
                },
                {
                    "metadata": {"name": "conservation-tool-db-abc"},
                    "status": {
                        "containerStatuses": [
                            {
                                "name": "postgresql",
                                "restartCount": 0,
                                "state": {"running": {}},
                            }
                        ],
                    },
                },
                {
                    "metadata": {"name": "unrelated-app"},
                    "status": {
                        "containerStatuses": [
                            {"name": "app", "restartCount": 2, "state": {"waiting": {}}}
                        ],
                    },
                },
            ]
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "commands.jsonl"
            data = root / "pods.json"
            data.write_text(json.dumps(pods))
            for command in ("oc", "helm"):
                path = root / command
                path.write_text(FAKE_CLIENT)
                path.chmod(0o700)
            result = subprocess.run(
                ["bash", str(SCRIPT), "test-namespace"],
                env={
                    **os.environ,
                    "PATH": f'{root}:{os.environ["PATH"]}',
                    "COMMAND_LOG": str(log),
                    "PODS_FILE": str(data),
                },
                capture_output=True,
                text=True,
                timeout=10,
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]
        self.assertEqual(result.returncode, 0, result.stderr)
        log_calls = [call for call in calls if call[:2] == ["oc", "logs"]]
        self.assertEqual(len(log_calls), 3)
        self.assertEqual(sum("--previous" in call for call in log_calls), 1)
        self.assertTrue(
            all("conservation-tool-prefect-worker-abc" in call for call in log_calls)
        )
        self.assertTrue(all("test-namespace" in call for call in calls))
        self.assertFalse(
            any(call[1] in ("delete", "patch", "scale", "apply") for call in calls)
        )
