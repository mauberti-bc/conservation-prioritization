#!/usr/bin/env bash
# Start one process worker after Prefect becomes available. Registration belongs
# to the post-install/post-upgrade Job, not to each worker restart.
set -euo pipefail

work_pool_name="${1:?A work-pool name is required.}"
python -m src.utils.wait_for_prefect
bash src/ensure_work_pool.sh "$work_pool_name" process
exec prefect worker start --pool "$work_pool_name"
