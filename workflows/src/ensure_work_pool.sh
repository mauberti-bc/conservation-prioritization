#!/usr/bin/env bash
set -euo pipefail

WORK_POOL_NAME="${1:?A work-pool name is required.}"
WORK_POOL_TYPE="${2:-process}"
WORK_POOL_CONCURRENCY="${3:-1}"

if prefect work-pool inspect "$WORK_POOL_NAME" >/dev/null 2>&1; then
  echo "Work pool '$WORK_POOL_NAME' already exists."
else
  echo "Creating $WORK_POOL_TYPE work pool '$WORK_POOL_NAME'..."
  if prefect work-pool create "$WORK_POOL_NAME" --type "$WORK_POOL_TYPE"; then
    echo "Created work pool '$WORK_POOL_NAME'."
  elif prefect work-pool inspect "$WORK_POOL_NAME" >/dev/null 2>&1; then
    echo "Work pool '$WORK_POOL_NAME' was created concurrently."
  else
    echo "Failed to create work pool '$WORK_POOL_NAME'." >&2
    exit 1
  fi
fi

prefect work-pool set-concurrency-limit "$WORK_POOL_NAME" "$WORK_POOL_CONCURRENCY"
echo "Set work pool '$WORK_POOL_NAME' concurrency to $WORK_POOL_CONCURRENCY."
