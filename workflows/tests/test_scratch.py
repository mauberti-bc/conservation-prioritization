import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.utils.scratch import directory_size_bytes, enforce_scratch_limit


class ScratchTest(unittest.TestCase):
    def test_directory_size_bytes_counts_regular_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "nested").mkdir()
            (root / "a.bin").write_bytes(b"abc")
            (root / "nested" / "b.bin").write_bytes(b"12345")

            self.assertEqual(8, directory_size_bytes(root))

    def test_enforce_scratch_limit_allows_small_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.bin").write_bytes(b"abc")

            with patch.dict(os.environ, {"WORKFLOW_SCRATCH_LIMIT_BYTES": "3"}):
                self.assertEqual(3, enforce_scratch_limit(root, "test"))

    def test_enforce_scratch_limit_rejects_large_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.bin").write_bytes(b"abcd")

            with patch.dict(os.environ, {"WORKFLOW_SCRATCH_LIMIT_BYTES": "3"}):
                with self.assertRaisesRegex(RuntimeError, "Workflow scratch exceeded"):
                    enforce_scratch_limit(root, "test")


if __name__ == "__main__":
    unittest.main()
