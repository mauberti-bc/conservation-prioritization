"""Verify startup readiness retries are bounded and do not hide client errors."""

import unittest
from unittest.mock import MagicMock, patch

import requests

from src.utils.wait_for_prefect import wait_for_prefect


class WaitForPrefectTests(unittest.TestCase):
    """Exercise transient, permanent, and successful startup responses."""

    def response(self, status):
        """Build a context-managed response with the requested HTTP status."""
        response = MagicMock()
        response.status_code = status
        response.__enter__.return_value = response
        if status >= 400:
            response.raise_for_status.side_effect = requests.HTTPError(str(status))
        return response

    def test_recovers_after_connection_and_server_errors(self):
        """Transient failures wait before starting instead of crashing immediately."""
        now = [0.0]
        with (
            patch(
                'src.utils.wait_for_prefect.requests.post',
                side_effect=[
                    requests.ConnectionError(),
                    self.response(503),
                    self.response(200),
                ],
            ) as get,
            patch(
                'src.utils.wait_for_prefect.time.monotonic', side_effect=lambda: now[0]
            ),
            patch(
                'src.utils.wait_for_prefect.time.sleep',
                side_effect=lambda seconds: now.__setitem__(0, now[0] + seconds),
            ),
        ):
            wait_for_prefect('http://prefect/api/', timeout_seconds=20)
        self.assertEqual(get.call_count, 3)
        self.assertEqual(get.call_args.args[0], 'http://prefect/api/work_pools/filter')
        self.assertEqual(now[0], 10)

    def test_persistent_failure_reaches_deadline(self):
        """A dead API cannot leave startup waiting indefinitely."""
        now = [0.0]
        with (
            patch(
                'src.utils.wait_for_prefect.requests.post',
                side_effect=requests.Timeout(),
            ) as get,
            patch(
                'src.utils.wait_for_prefect.time.monotonic', side_effect=lambda: now[0]
            ),
            patch(
                'src.utils.wait_for_prefect.time.sleep',
                side_effect=lambda seconds: now.__setitem__(0, now[0] + seconds),
            ),
        ):
            with self.assertRaises(TimeoutError):
                wait_for_prefect('http://prefect/api', timeout_seconds=6)
        self.assertEqual(get.call_count, 2)
        self.assertEqual(now[0], 6)
        self.assertEqual(get.call_args.kwargs['timeout'], 1)

    def test_authentication_failure_is_not_retried(self):
        """Bad credentials must surface as an error instead of a startup timeout."""
        with (
            patch(
                'src.utils.wait_for_prefect.requests.post',
                return_value=self.response(401),
            ) as get,
            patch('src.utils.wait_for_prefect.time.sleep') as sleep,
        ):
            with self.assertRaises(requests.HTTPError):
                wait_for_prefect('http://prefect/api')
        self.assertEqual(get.call_count, 1)
        sleep.assert_not_called()

    def test_invalid_configuration_stops_before_network_requests(self):
        """Reject absent URLs and unbounded or negative startup timeouts."""
        for url, timeout in [
            ('', 600),
            ('http://prefect/api', 0),
            ('http://prefect/api', float('inf')),
        ]:
            with (
                self.subTest(url=url, timeout=timeout),
                patch('src.utils.wait_for_prefect.requests.post') as get,
            ):
                with self.assertRaises(ValueError):
                    wait_for_prefect(url, timeout)
                get.assert_not_called()
