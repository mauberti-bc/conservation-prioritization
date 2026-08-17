import os
import time
from typing import Any, Dict

import requests


def internal_api_request(
    method: str,
    path: str,
    payload: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Call a run-scoped internal API endpoint with bounded transient retries."""
    api_url = os.getenv("CONSERVATION_API_URL")
    api_key = os.getenv("INTERNAL_API_KEY")
    if not api_url or not api_key:
        raise ValueError("CONSERVATION_API_URL and INTERNAL_API_KEY are required.")
    attempts = max(1, int(os.getenv("INTERNAL_API_RETRY_ATTEMPTS", "6")))
    backoff_seconds = max(
        0.0, float(os.getenv("INTERNAL_API_RETRY_BACKOFF_SECONDS", "0.5"))
    )
    transient_statuses = {502, 503, 504}
    for attempt in range(attempts):
        try:
            response = requests.request(
                method,
                f"{api_url.rstrip('/')}{path}",
                json=payload,
                headers={"x-internal-api-key": api_key},
                timeout=30,
            )
            if response.status_code not in transient_statuses:
                response.raise_for_status()
                return response.json()
            if attempt == attempts - 1:
                response.raise_for_status()
        except (requests.ConnectionError, requests.Timeout):
            if attempt == attempts - 1:
                raise
        time.sleep(backoff_seconds * (2**attempt))
    raise RuntimeError("Internal API retry loop ended without a response.")
