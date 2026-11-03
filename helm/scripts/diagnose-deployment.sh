#!/usr/bin/env bash
# Gather namespace-scoped rollout and container failures without modifying workloads.
# Argument: namespace. Best-effort diagnostics must not hide the original CI failure.
set -uo pipefail
namespace="${1:?OpenShift namespace required}"

helm history conservation-tool --namespace "$namespace" --max 5 || true
oc get deployments,pods,jobs,pvc --namespace "$namespace" --output wide --request-timeout=15s || true
oc get events --namespace "$namespace" --field-selector type=Warning --sort-by=.lastTimestamp --request-timeout=15s || true

pods="$(oc get pods --namespace "$namespace" --output json --request-timeout=15s)" || exit 0
while IFS=$'\t' read -r pod container restarts; do
  [[ -n "$pod" && -n "$container" ]] || continue
  echo "Container diagnostics: $pod / $container"
  oc logs "$pod" --container "$container" --namespace "$namespace" --tail=100 --timestamps --request-timeout=15s || true
  if [[ "$restarts" -gt 0 ]]; then
    oc logs "$pod" --container "$container" --namespace "$namespace" --previous --tail=100 --timestamps --request-timeout=15s || true
  fi
done < <(jq -r '
  .items[]
  | select(.metadata.name | startswith("conservation-tool-"))
  | .metadata.name as $pod
  | (.status.initContainerStatuses[]?, .status.containerStatuses[]?)
  | select(.state.waiting != null or (.state.terminated.exitCode // 0) != 0 or .restartCount > 0)
  | [$pod, .name, (.restartCount // 0)] | @tsv
' <<< "$pods")
