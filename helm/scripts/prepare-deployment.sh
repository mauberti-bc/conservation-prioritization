#!/usr/bin/env bash

# Validate a complete image set and prepare an existing database before Helm's pre-upgrade hook.
# Usage: bash helm/scripts/prepare-deployment.sh <namespace> <registry/project> <image-tag>
# Fails before Helm on missing images, pending releases, or a database that cannot become ready.
set -euo pipefail

namespace="${1:?OpenShift namespace required}"
repository="${2:?Image registry/project required}"
image_tag="${3:?Image tag required}"
script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils/retry.sh
source "$script_directory/utils/retry.sh"

if [[ ! "$image_tag" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]]; then
  echo "Invalid image tag: $image_tag" >&2
  exit 1
fi

retry_preflight oc get --raw=/readyz --request-timeout=15s >/dev/null
releases="$(retry_preflight helm list --all --filter '^conservation-tool$' --namespace "$namespace" --output json)"
release_status="$(jq -r '.[0].status // "absent"' <<< "$releases")"
if [[ "$release_status" == pending-* ]]; then
  echo "Helm release conservation-tool is $release_status in $namespace. Stop or finish the owning operation and inspect helm history before recovery; this pipeline will not delete release records." >&2
  exit 1
fi

umask 077
registry_config="$(mktemp)"
trap 'rm -f "$registry_config"' EXIT
printf '{"auths":{}}\n' > "$registry_config"
oc registry login --registry="${repository%%/*}" --to="$registry_config" >/dev/null
images=(frontend api database db-setup prefect-worker prefect-deploy)
for image in "${images[@]}"; do
  echo "Checking image $repository/$image:$image_tag"
  if ! retry_preflight oc image info "$repository/$image:$image_tag" --registry-config="$registry_config" --filter-by-os=linux/amd64 >/dev/null; then
    echo "Cannot pull $image:$image_tag. Rebuild the complete release before deploying; no workload images have been changed." >&2
    exit 1
  fi
done

database="$(retry_preflight oc get deployment conservation-tool-db --namespace "$namespace" --ignore-not-found --output json --request-timeout=15s)"
if [[ -z "$database" ]]; then
  if [[ "$release_status" != absent ]]; then
    echo "Existing release is missing its database Deployment. Restore it before running the pre-upgrade migrations." >&2
    exit 1
  fi
  echo "First installation: Helm will create PostgreSQL before its post-install migrations."
  exit 0
fi

# Recover only an unavailable database whose current PostgreSQL image cannot be pulled.
# Other database failures must not cause an automatic image change outside Helm.
ready_replicas="$(jq -r '.status.readyReplicas // 0' <<< "$database")"
if [[ "$ready_replicas" == 0 ]]; then
  current_image="$(jq -r '.spec.template.spec.containers[] | select(.name == "postgresql") | .image' <<< "$database")"
  pods="$(retry_preflight oc get pods --namespace "$namespace" --selector app=conservation-tool-db --output json --request-timeout=15s)"
  if jq -e --arg image "$current_image" '[.items[].status.containerStatuses[]? | select(.name == "postgresql" and .image == $image) | .state.waiting.reason | select(. == "ImagePullBackOff" or . == "ErrImagePull")] | length > 0' <<< "$pods" >/dev/null; then
    echo "Recovering PostgreSQL from an image-pull failure using $repository/database:$image_tag"
    oc set image deployment/conservation-tool-db "postgresql=$repository/database:$image_tag" --namespace "$namespace" --request-timeout=30s
  fi
fi

echo "Waiting for PostgreSQL readiness before Prefect migrations."
oc rollout status deployment/conservation-tool-db --namespace "$namespace" --timeout=5m
