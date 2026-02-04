#!/bin/bash

# File: scripts/setup-openshift-secrets.sh
# Usage: ./scripts/setup-openshift-secrets.sh <namespace>
# Example: ./scripts/setup-openshift-secrets.sh dev-tools

set -e

NAMESPACE="${1:?Namespace required (e.g., dev-tools)}"

echo "Setting up OpenShift secrets in namespace: $NAMESPACE"
echo "This script uses oc CLI. Install with: https://docs.openshift.com/cli"

# Check if oc is installed
if ! command -v oc &> /dev/null; then
  echo "Error: OpenShift CLI (oc) is not installed."
  exit 1
fi

# Log in (assumes OC_TOKEN or prompt)
if [ -z "$OC_TOKEN" ]; then
  read -s -p "Enter OpenShift token: " OC_TOKEN
  echo ""
fi

oc login --token="$OC_TOKEN" --server="$OPENSHIFT_SERVER" --insecure-skip-tls-verify=true
oc project "$NAMESPACE"

# Helper function to create/update secret
create_secret() {
  local secret_name="$1"
  shift
  local kv_pairs=("$@")

  echo "Creating/updating secret: $secret_name"

  # Prepare --from-literal args
  local args=()
  for kv in "${kv_pairs[@]}"; do
    args+=(--from-literal="$kv")
  done

  # Check if secret exists
  if oc get secret "$secret_name" &> /dev/null; then
    echo "Secret $secret_name exists — updating..."
    oc delete secret "$secret_name"
  fi

  oc create secret generic "$secret_name" "${args[@]}" --namespace="$NAMESPACE"
  echo "Secret $secret_name created!"
  echo ""
}

echo "=== Database Credentials ==="
read -p "DB Host: " DB_HOST
read -p "DB User (API): " DB_USER_API
read -s -p "DB Password (API): " DB_USER_API_PASS
echo ""
read -p "DB User (Prefect): " DB_USER_PREFECT
read -s -p "DB Password (Prefect): " DB_USER_PREFECT_PASS
echo ""
read -p "DB Admin User: " DB_ADMIN
read -s -p "DB Admin Password: " DB_ADMIN_PASS
echo ""
read -p "DB Name: " DB_DATABASE
read -p "DB Port (default 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "DB Schema: " DB_SCHEMA

create_secret "conservation-tool-db" \
  "DB_HOST=$DB_HOST" \
  "DB_PORT=$DB_PORT" \
  "DB_DATABASE=$DB_DATABASE" \
  "DB_USER_API=$DB_USER_API" \
  "DB_USER_API_PASS=$DB_USER_API_PASS" \
  "DB_USER_PREFECT=$DB_USER_PREFECT" \
  "DB_USER_PREFECT_PASS=$DB_USER_PREFECT_PASS" \
  "DB_ADMIN=$DB_ADMIN" \
  "DB_ADMIN_PASS=$DB_ADMIN_PASS" \
  "DB_SCHEMA=$DB_SCHEMA"

echo "=== Prefect Credentials ==="
read -p "Prefect Database URL (e.g., postgresql+asyncpg://user:pass@host:5432/db): " PREFECT_DB_URL

create_secret "conservation-tool-prefect-db" \
  "PREFECT_API_DATABASE_CONNECTION_URL=$PREFECT_DB_URL"

echo "=== Object Storage Credentials ==="
read -p "Object Store URL (e.g., http://minio:9000): " OBJECT_STORE_URL
read -p "Access Key ID: " OBJECT_STORE_ACCESS_KEY_ID
read -s -p "Secret Key ID: " OBJECT_STORE_SECRET_KEY_ID
echo ""
read -p "Bucket Name: " OBJECT_STORE_BUCKET_NAME
read -p "S3 Key Prefix: " S3_KEY_PREFIX

create_secret "conservation-tool-object-storage" \
  "OBJECT_STORE_URL=$OBJECT_STORE_URL" \
  "OBJECT_STORE_ACCESS_KEY_ID=$OBJECT_STORE_ACCESS_KEY_ID" \
  "OBJECT_STORE_SECRET_KEY_ID=$OBJECT_STORE_SECRET_KEY_ID" \
  "OBJECT_STORE_BUCKET_NAME=$OBJECT_STORE_BUCKET_NAME" \
  "S3_KEY_PREFIX=$S3_KEY_PREFIX"

echo "=== Keycloak Credentials ==="
read -p "Keycloak Host: " KEYCLOAK_HOST
read -p "Realm: " KEYCLOAK_REALM
read -p "Admin Username: " KEYCLOAK_ADMIN_USERNAME
read -s -p "Admin Password: " KEYCLOAK_ADMIN_PASSWORD
echo ""
read -p "API Token URL: " KEYCLOAK_API_TOKEN_URL
read -p "API Client ID: " KEYCLOAK_API_CLIENT_ID
read -s -p "API Client Secret: " KEYCLOAK_API_CLIENT_SECRET
echo ""
read -p "API Host: " KEYCLOAK_API_HOST
read -p "API Environment: " KEYCLOAK_API_ENVIRONMENT

create_secret "conservation-tool-keycloak" \
  "KEYCLOAK_HOST=$KEYCLOAK_HOST" \
  "KEYCLOAK_REALM=$KEYCLOAK_REALM" \
  "KEYCLOAK_ADMIN_USERNAME=$KEYCLOAK_ADMIN_USERNAME" \
  "KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD" \
  "KEYCLOAK_API_TOKEN_URL=$KEYCLOAK_API_TOKEN_URL" \
  "KEYCLOAK_API_CLIENT_ID=$KEYCLOAK_API_CLIENT_ID" \
  "KEYCLOAK_API_CLIENT_SECRET=$KEYCLOAK_API_CLIENT_SECRET" \
  "KEYCLOAK_API_HOST=$KEYCLOAK_API_HOST" \
  "KEYCLOAK_API_ENVIRONMENT=$KEYCLOAK_API_ENVIRONMENT"

echo "=== OpenShift Configuration ==="
read -p "Tools Namespace: " TOOLS_NAMESPACE
read -s -p "Tools Service Account Token: " TOOLS_SA_TOKEN
echo ""

create_secret "conservation-tool-openshift" \
  "TOOLS_NAMESPACE=$TOOLS_NAMESPACE" \
  "TOOLS_SA_TOKEN=$TOOLS_SA_TOKEN"

echo ""
echo "✅ All OpenShift secrets created successfully in namespace $NAMESPACE!"