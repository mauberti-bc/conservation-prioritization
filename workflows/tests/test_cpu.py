import unittest
from unittest.mock import patch

from src.utils.cpu import available_cpu_count


class AvailableCpuCountTest(unittest.TestCase):
    """Verify portable process CPU-capacity detection."""

    def test_process_affinity_is_authoritative(self) -> None:
        """Use the process CPU set instead of the wider machine count."""
        with patch(
            "src.utils.cpu.os.sched_getaffinity",
            return_value={1, 3, 5},
            create=True,
        ):
            with patch("src.utils.cpu.os.cpu_count", return_value=12):
                self.assertEqual(3, available_cpu_count())

    def test_machine_count_is_used_when_affinity_lookup_fails(self) -> None:
        """Fall back to the machine count when affinity cannot be inspected."""
        with patch(
            "src.utils.cpu.os.sched_getaffinity",
            side_effect=OSError("affinity unavailable"),
            create=True,
        ):
            with patch("src.utils.cpu.os.cpu_count", return_value=8):
                self.assertEqual(8, available_cpu_count())

    def test_cpu_detection_always_returns_a_positive_count(self) -> None:
        """Return one CPU when the platform reports no usable capacity."""
        with patch(
            "src.utils.cpu.os.sched_getaffinity",
            side_effect=OSError("affinity unavailable"),
            create=True,
        ):
            with patch("src.utils.cpu.os.cpu_count", return_value=None):
                self.assertEqual(1, available_cpu_count())


if __name__ == "__main__":
    unittest.main()
