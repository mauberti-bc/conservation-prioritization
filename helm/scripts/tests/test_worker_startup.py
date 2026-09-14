"""Run the worker entrypoint against fake commands without contacting Prefect."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPOSITORY = Path(__file__).resolve().parents[3]
FAKE_COMMAND = """#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
with Path(os.environ['COMMAND_LOG']).open('a') as output:
    output.write(json.dumps([name, *sys.argv[1:]]) + '\\n')
if name == 'python' and os.environ.get('FAIL_HEALTH') == '1':
    sys.exit(1)
if name == 'prefect' and sys.argv[1:3] == ['work-pool', 'set-concurrency-limit'] and os.environ.get('FAIL_POOL') == '1':
    sys.exit(1)
"""


class WorkerStartupTests(unittest.TestCase):
    def run_startup(self, **flags):
        """Execute the entrypoint with isolated fake health and Prefect commands."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "commands.jsonl"
            for command in ("python", "prefect"):
                path = root / command
                path.write_text(FAKE_COMMAND)
                path.chmod(0o700)
            result = subprocess.run(
                ["bash", "src/start_worker.sh", "sparse-solver"],
                cwd=REPOSITORY / "workflows",
                env={
                    **os.environ,
                    "PATH": f'{root}:{os.environ["PATH"]}',
                    "COMMAND_LOG": str(log),
                    **flags,
                },
                capture_output=True,
                text=True,
                timeout=10,
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            return result, calls

    def test_waits_and_prepares_pool_before_starting_worker(self):
        """Worker startup can succeed before the post-install registration hook."""
        result, calls = self.run_startup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[0], ["python", "-m", "src.utils.wait_for_prefect"])
        self.assertIn(
            ["prefect", "work-pool", "set-concurrency-limit", "sparse-solver", "1"],
            calls,
        )
        self.assertEqual(
            calls[-1], ["prefect", "worker", "start", "--pool", "sparse-solver"]
        )
        self.assertFalse(
            any(
                "deploy" in call or "src.utils.flow_run_recovery" in call
                for call in calls
            )
        )

    def test_health_failure_stops_before_prefect_mutations(self):
        """Unreachable Prefect cannot start a worker or mutate pools."""
        result, calls = self.run_startup(FAIL_HEALTH="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)

    def test_pool_failure_stops_before_starting_worker(self):
        """Pool configuration errors remain visible startup errors."""
        result, calls = self.run_startup(FAIL_POOL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(
            any(call[:3] == ["prefect", "worker", "start"] for call in calls)
        )
