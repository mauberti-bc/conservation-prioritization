#!/bin/bash
set -e

WORK_POOL_NAME="local"

# Check if work pool "local" exists, create if not
if ! prefect work-pool ls | grep -qw "$WORK_POOL_NAME"; then
  echo "Creating process work pool '$WORK_POOL_NAME'..."
  prefect work-pool create "$WORK_POOL_NAME" --type process
else
  echo "Work pool '$WORK_POOL_NAME' already exists."
fi

# Apply deployments from prefect.yaml
echo "Applying deployments..."
prefect --no-prompt deploy --all

echo "Setup complete."
