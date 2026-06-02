#!/usr/bin/env bash

# File: scripts/setup-openshift-secrets.sh
# Usage:
#   ./scripts/setup-openshift-secrets.sh <namespace> [env_file]
#
# Examples:
#   ./scripts/setup-openshift-secrets.sh fa9440-dev
#   ./scripts/setup-openshift-secrets.sh fa9440-test .env.test
#   ./scripts/setup-openshift-secrets.sh fa9440-prod .env.prod

set -euo pipefail

NAMESPACE="${1:?Namespace required, e.g. fa9440-dev}"
ENV_FILE="${2:-.env}"

echo "Setting up OpenShift secrets in namespace: $NAMESPACE"
echo "Using env file: $ENV_FILE"

if ! command -v oc >/dev/null 2>&1; then
  echo "Error: OpenShift CLI (oc) is not installed."
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "Loading environment variables from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Warning: Env file '$ENV_FILE' not found. Falling back to interactive prompts."
fi

prompt_if_missing() {
  local var_name="$1"
  local prompt_text="$2"
  local is_secret="${3:-false}"
  local current_value="${!var_name:-}"

  if [[ -n "$current_value" ]]; then
    return
  fi

  if [[ "$is_secret" == "true" ]]; then
    read -r -s -p "$prompt_text: " current_value
    echo ""
  else
    read -r -p "$prompt_text: " current_value
  fi

  export "$var_name=$current_value"
}

create_secret() {
  local secret_name="$1"
  shift
  local kv_pairs=("$@")

  echo "Creating/updating secret: $secret_name"

  local args=()
  for kv in "${kv_pairs[@]}"; do
    args+=(--from-literal="$kv")
  done

  oc create secret generic "$secret_name" \
    "${args[@]}" \
    --namespace="$NAMESPACE" \
    --dry-run=client \
    -o yaml | oc apply -f -

  echo "Secret $secret_name applied."
  echo ""
}

# Login config. These are local/operator inputs only, not app secrets.
prompt_if_missing "OPENSHIFT_SERVER" "OpenShift server URL"
prompt_if_missing "OC_TOKEN" "OpenShift token" true

oc login --token="$OC_TOKEN" --server="$OPENSHIFT_SERVER"
oc project "$NAMESPACE"

echo "=== API Secrets ==="
prompt_if_missing "INTERNAL_API_KEY" "Internal API Key" true
prompt_if_missing "PREFECT_API_KEY" "Prefect API Key, optional" true

create_secret "conservation-tool-api" \
  "INTERNAL_API_KEY=$INTERNAL_API_KEY" \
  "PREFECT_API_KEY=${PREFECT_API_KEY:-}"

echo "=== Database Secrets ==="
prompt_if_missing "DB_USER_API" "DB User (API)"
prompt_if_missing "DB_USER_API_PASS" "DB Password (API)" true
prompt_if_missing "DB_USER_PREFECT" "DB User (Prefect)"
prompt_if_missing "DB_USER_PREFECT_PASS" "DB Password (Prefect)" true
prompt_if_missing "DB_ADMIN" "DB Admin User"
prompt_if_missing "DB_ADMIN_PASS" "DB Admin Password" true
prompt_if_missing "DB_DATABASE" "DB Name"
prompt_if_missing "DB_SCHEMA" "DB Schema"

create_secret "conservation-tool-db" \
  "DB_DATABASE=$DB_DATABASE" \
  "DB_SCHEMA=$DB_SCHEMA" \
  "DB_USER_API=$DB_USER_API" \
  "DB_USER_API_PASS=$DB_USER_API_PASS" \
  "DB_USER_PREFECT=$DB_USER_PREFECT" \
  "DB_USER_PREFECT_PASS=$DB_USER_PREFECT_PASS" \
  "DB_ADMIN=$DB_ADMIN" \
  "DB_ADMIN_PASS=$DB_ADMIN_PASS"

echo "=== Prefect Database Secret ==="
prompt_if_missing "PREFECT_API_DATABASE_CONNECTION_URL" "Prefect Database URL, e.g. postgresql+asyncpg://user:pass@host:5432/db" true

create_secret "conservation-tool-prefect-db" \
  "PREFECT_API_DATABASE_CONNECTION_URL=$PREFECT_API_DATABASE_CONNECTION_URL" \
  "connection-string=$PREFECT_API_DATABASE_CONNECTION_URL"

echo "=== Object Storage Secrets ==="
prompt_if_missing "OBJECT_STORE_URL" "Object Store URL"
prompt_if_missing "OBJECT_STORE_ACCESS_KEY_ID" "Object Store Access Key ID"
prompt_if_missing "OBJECT_STORE_SECRET_KEY_ID" "Object Store Secret Key ID" true
prompt_if_missing "OBJECT_STORE_BUCKET_NAME" "Object Store Bucket Name"
prompt_if_missing "S3_KEY_PREFIX" "Object Store S3 Key Prefix"

create_secret "conservation-tool-object-storage" \
  "OBJECT_STORE_URL=$OBJECT_STORE_URL" \
  "OBJECT_STORE_ACCESS_KEY_ID=$OBJECT_STORE_ACCESS_KEY_ID" \
  "OBJECT_STORE_SECRET_KEY_ID=$OBJECT_STORE_SECRET_KEY_ID" \
  "OBJECT_STORE_BUCKET_NAME=$OBJECT_STORE_BUCKET_NAME" \
  "S3_KEY_PREFIX=$S3_KEY_PREFIX"

echo "=== Keycloak Secrets ==="
prompt_if_missing "KEYCLOAK_HOST" "Keycloak Host"
prompt_if_missing "KEYCLOAK_REALM" "Keycloak Realm"
prompt_if_missing "KEYCLOAK_ADMIN_USERNAME" "Keycloak Admin Username"
prompt_if_missing "KEYCLOAK_ADMIN_PASSWORD" "Keycloak Admin Password" true
prompt_if_missing "KEYCLOAK_API_TOKEN_URL" "Keycloak API Token URL"
prompt_if_missing "KEYCLOAK_CLIENT_ID" "Keycloak Frontend Client ID"
prompt_if_missing "KEYCLOAK_API_CLIENT_ID" "Keycloak API Client ID"
prompt_if_missing "KEYCLOAK_API_CLIENT_SECRET" "Keycloak API Client Secret" true
prompt_if_missing "KEYCLOAK_API_HOST" "Keycloak API Host"
prompt_if_missing "KEYCLOAK_API_ENVIRONMENT" "Keycloak API Environment"

create_secret "conservation-tool-keycloak" \
  "KEYCLOAK_HOST=$KEYCLOAK_HOST" \
  "KEYCLOAK_REALM=$KEYCLOAK_REALM" \
  "KEYCLOAK_ADMIN_USERNAME=$KEYCLOAK_ADMIN_USERNAME" \
  "KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD" \
  "KEYCLOAK_API_TOKEN_URL=$KEYCLOAK_API_TOKEN_URL" \
  "KEYCLOAK_CLIENT_ID=$KEYCLOAK_CLIENT_ID" \
  "KEYCLOAK_API_CLIENT_ID=$KEYCLOAK_API_CLIENT_ID" \
  "KEYCLOAK_API_CLIENT_SECRET=$KEYCLOAK_API_CLIENT_SECRET" \
  "KEYCLOAK_API_HOST=$KEYCLOAK_API_HOST" \
  "KEYCLOAK_API_ENVIRONMENT=$KEYCLOAK_API_ENVIRONMENT"

echo ""
echo "✅ OpenShift secrets created successfully in namespace $NAMESPACE."
echo ""
echo "Runtime service config not covered by these secrets should be set through Helm values:"
echo "  OBJECT_STORE_FORCE_PATH_STYLE"
echo "  TOOLS_NAMESPACE"
echo "  TOOLS_SA_TOKEN should stay in GitHub Actions secrets, not app OpenShift secrets."
