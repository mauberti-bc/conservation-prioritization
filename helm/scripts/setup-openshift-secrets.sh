#!/usr/bin/env bash

# File: scripts/setup-openshift-secrets.sh
# Usage:
#   ./scripts/setup-openshift-secrets.sh <namespace> [env_file]
#
# Examples:
#   ./scripts/setup-openshift-secrets.sh dev-tools
#   ./scripts/setup-openshift-secrets.sh dev-tools .env
#   ./scripts/setup-openshift-secrets.sh dev-tools .env.test
#   ./scripts/setup-openshift-secrets.sh prod-tools .env.prod

set -euo pipefail

NAMESPACE="${1:?Namespace required (e.g., dev-tools)}"
ENV_FILE="${2:-.env}"

echo "Setting up OpenShift secrets in namespace: $NAMESPACE"
echo "Using env file: $ENV_FILE"
echo "This script uses oc CLI. Install with: https://docs.openshift.com/cli"

# Check if oc is installed
if ! command -v oc >/dev/null 2>&1; then
  echo "Error: OpenShift CLI (oc) is not installed."
  exit 1
fi

# Load env file if it exists
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

# Login config
prompt_if_missing "OPENSHIFT_SERVER" "OpenShift server URL"
prompt_if_missing "OC_TOKEN" "OpenShift token" true

oc login --token="$OC_TOKEN" --server="$OPENSHIFT_SERVER" --insecure-skip-tls-verify=true
oc project "$NAMESPACE"

create_secret() {
  local secret_name="$1"
  shift
  local kv_pairs=("$@")

  echo "Creating/updating secret: $secret_name"

  local args=()
  for kv in "${kv_pairs[@]}"; do
    args+=(--from-literal="$kv")
  done

  if oc get secret "$secret_name" --namespace="$NAMESPACE" >/dev/null 2>&1; then
    echo "Secret $secret_name exists — updating..."
    oc delete secret "$secret_name" --namespace="$NAMESPACE"
  fi

  oc create secret generic "$secret_name" "${args[@]}" --namespace="$NAMESPACE"
  echo "Secret $secret_name created!"
  echo ""
}

echo "=== API Credentials ==="
prompt_if_missing "INTERNAL_API_KEY" "Internal API Key" true

create_secret "conservation-tool-api" \
  "INTERNAL_API_KEY=$INTERNAL_API_KEY"

echo "=== Database Credentials ==="
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
  "DB_USER_API=$DB_USER_API" \
  "DB_USER_API_PASS=$DB_USER_API_PASS" \
  "DB_USER_PREFECT=$DB_USER_PREFECT" \
  "DB_USER_PREFECT_PASS=$DB_USER_PREFECT_PASS" \
  "DB_ADMIN=$DB_ADMIN" \
  "DB_ADMIN_PASS=$DB_ADMIN_PASS" \
  "DB_SCHEMA=$DB_SCHEMA"

echo "=== Prefect Credentials ==="
prompt_if_missing "PREFECT_API_DATABASE_CONNECTION_URL" "Prefect Database URL (e.g., postgresql+asyncpg://user:pass@host:5432/db)"

create_secret "conservation-tool-prefect-db" \
  "PREFECT_API_DATABASE_CONNECTION_URL=$PREFECT_API_DATABASE_CONNECTION_URL" \
  "connection-string=$PREFECT_API_DATABASE_CONNECTION_URL"

echo "=== Object Storage Credentials ==="
prompt_if_missing "OBJECT_STORE_URL" "Object Store URL (e.g., http://minio:9000)"
prompt_if_missing "OBJECT_STORE_ACCESS_KEY_ID" "Access Key ID"
prompt_if_missing "OBJECT_STORE_SECRET_KEY_ID" "Secret Key ID" true
prompt_if_missing "OBJECT_STORE_BUCKET_NAME" "Bucket Name"
prompt_if_missing "S3_KEY_PREFIX" "S3 Key Prefix"

create_secret "conservation-tool-object-storage" \
  "OBJECT_STORE_URL=$OBJECT_STORE_URL" \
  "OBJECT_STORE_ACCESS_KEY_ID=$OBJECT_STORE_ACCESS_KEY_ID" \
  "OBJECT_STORE_SECRET_KEY_ID=$OBJECT_STORE_SECRET_KEY_ID" \
  "OBJECT_STORE_BUCKET_NAME=$OBJECT_STORE_BUCKET_NAME" \
  "S3_KEY_PREFIX=$S3_KEY_PREFIX"

echo "=== Keycloak Credentials ==="
prompt_if_missing "KEYCLOAK_HOST" "Keycloak Host"
prompt_if_missing "KEYCLOAK_REALM" "Realm"
prompt_if_missing "KEYCLOAK_ADMIN_USERNAME" "Admin Username"
prompt_if_missing "KEYCLOAK_ADMIN_PASSWORD" "Admin Password" true
prompt_if_missing "KEYCLOAK_API_TOKEN_URL" "API Token URL"
prompt_if_missing "KEYCLOAK_CLIENT_ID" "App Client ID"
prompt_if_missing "KEYCLOAK_API_CLIENT_ID" "API Client ID"
prompt_if_missing "KEYCLOAK_API_CLIENT_SECRET" "API Client Secret" true
prompt_if_missing "KEYCLOAK_API_HOST" "API Host"
prompt_if_missing "KEYCLOAK_API_ENVIRONMENT" "API Environment"

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

echo "=== OpenShift Configuration ==="
prompt_if_missing "TOOLS_NAMESPACE" "Tools Namespace"
prompt_if_missing "TOOLS_SA_TOKEN" "Tools Service Account Token" true

create_secret "conservation-tool-openshift" \
  "TOOLS_NAMESPACE=$TOOLS_NAMESPACE" \
  "TOOLS_SA_TOKEN=$TOOLS_SA_TOKEN"

echo ""
echo "✅ All OpenShift secrets created successfully in namespace $NAMESPACE!"