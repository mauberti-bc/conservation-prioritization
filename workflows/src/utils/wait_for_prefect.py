"""Wait for the configured Prefect API without registering or modifying resources."""

import math
import os
import time

import requests


def wait_for_prefect(api_url: str, timeout_seconds: float = 600) -> None:
    """Wait for a read-only work-pool query to confirm API and database readiness.

    Args:
        api_url: Configured Prefect API base URL, including its API prefix.
        timeout_seconds: Maximum time allowed for startup connectivity retries.

    Returns:
        None when the API responds successfully.

    Raises:
        ValueError: The API URL or timeout is missing or invalid.
        requests.HTTPError: The API rejects authentication or another client input.
        TimeoutError: Prefect remains unavailable beyond the startup deadline.
    """
    if not api_url or not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ValueError(
            "PREFECT_API_URL and a positive finite startup timeout are required."
        )
    deadline = time.monotonic() + timeout_seconds
    headers = {}
    if api_key := os.getenv("PREFECT_API_KEY"):
        headers["Authorization"] = f"Bearer {api_key}"
    print("Waiting for the Prefect API before startup...", flush=True)
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(
                "Prefect API did not become available before the startup deadline."
            )
        try:
            with requests.post(
                f"{api_url.rstrip('/')}/work_pools/filter",
                json={"limit": 1},
                headers=headers,
                timeout=min(10.0, remaining),
            ) as response:
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    response.raise_for_status()
                if response.status_code == 200:
                    print("Prefect API is available.", flush=True)
                    return
                print(
                    f"Prefect readiness query returned HTTP {response.status_code}; waiting...",
                    flush=True,
                )
        except (requests.ConnectionError, requests.Timeout):
            print("Prefect API is not reachable yet; waiting...", flush=True)
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(5.0, remaining))


if __name__ == "__main__":
    wait_for_prefect(
        os.getenv("PREFECT_API_URL", ""),
        float(os.getenv("PREFECT_STARTUP_TIMEOUT_SECONDS", "600")),
    )
