#!/usr/bin/env bash
set -euo pipefail

WORK_POOL_NAMES=(
  "sparse-solver"
)
TASK_RUN_CONCURRENCY_LIMIT="conservation-task-runs"

for work_pool_name in "${WORK_POOL_NAMES[@]}"; do
  bash src/ensure_work_pool.sh "$work_pool_name" process
done

if prefect global-concurrency-limit inspect "$TASK_RUN_CONCURRENCY_LIMIT" >/dev/null 2>&1; then
  prefect global-concurrency-limit update "$TASK_RUN_CONCURRENCY_LIMIT" --limit 1 --enable
else
  prefect global-concurrency-limit create "$TASK_RUN_CONCURRENCY_LIMIT" --limit 1
fi

# Apply deployments from prefect.yaml
echo "Applying deployments..."
prefect --no-prompt deploy --all

echo "Setup complete."
