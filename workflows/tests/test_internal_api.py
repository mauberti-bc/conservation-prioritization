import os
import unittest
from unittest.mock import Mock, patch

import requests

from src.utils.internal_api import internal_api_request


class InternalApiRequestTests(unittest.TestCase):
    """Verify bounded recovery from API restarts during long workflow runs."""

    @patch("src.utils.internal_api.time.sleep")
    @patch("src.utils.internal_api.requests.request")
    def test_retries_connection_refusal_without_losing_post_payload(
        self, request: Mock, sleep: Mock
    ) -> None:
        response = Mock(status_code=200)
        response.json.return_value = {"status": "ready"}
        request.side_effect = [requests.ConnectionError("refused"), response]

        with patch.dict(
            os.environ,
            {
                "CONSERVATION_API_URL": "http://api:5200/api",
                "INTERNAL_API_KEY": "service-key",
                "INTERNAL_API_RETRY_ATTEMPTS": "2",
                "INTERNAL_API_RETRY_BACKOFF_SECONDS": "0",
            },
        ):
            result = internal_api_request(
                "POST", "/internal/run/run-id/status", {"status": "completed"}
            )

        self.assertEqual({"status": "ready"}, result)
        self.assertEqual(2, request.call_count)
        self.assertEqual({"status": "completed"}, request.call_args.kwargs["json"])
        sleep.assert_called_once_with(0.0)

    @patch("src.utils.internal_api.time.sleep")
    @patch("src.utils.internal_api.requests.request")
    def test_does_not_retry_contract_errors(self, request: Mock, sleep: Mock) -> None:
        response = Mock(status_code=400)
        response.raise_for_status.side_effect = requests.HTTPError("bad request")
        request.return_value = response

        with patch.dict(
            os.environ,
            {
                "CONSERVATION_API_URL": "http://api:5200/api",
                "INTERNAL_API_KEY": "service-key",
            },
        ):
            with self.assertRaises(requests.HTTPError):
                internal_api_request("POST", "/internal/run/run-id/status", {})

        self.assertEqual(1, request.call_count)
        sleep.assert_not_called()
