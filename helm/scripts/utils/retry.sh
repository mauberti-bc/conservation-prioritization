#!/usr/bin/env bash

# Retry a read-only preflight command up to three times for transient API/registry failures.
# Arguments: command and its arguments. Returns nonzero after all attempts fail.
retry_preflight() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then
      return 0
    fi
    if [[ "$attempt" -lt 3 ]]; then
      echo "Preflight request failed; retrying in 15 seconds ($attempt/3)." >&2
      sleep 15
    fi
  done
  return 1
}
