# Using OpenShift Secrets with Helm Deployment

## Overview

This guide explains how to use OpenShift secrets in your deployment:
- **Frontend**: Bake secrets into the Docker image at build time (compiled into static files)
- **Backend Services**: Pass secrets at runtime via Helm to running containers

## How It Works

### Frontend: Build-Time Secrets

```
OpenShift Secret (managed in OpenShift)
    ↓
GitHub Actions (retrieves secret with oc get)
    ↓
Docker build --build-arg VITE_PREFECT_API_URL="..."
    ↓
Frontend build process (Vite bakes into static files)
    ↓
Docker image with hardcoded config
    ↓
Frontend container runs (no env vars needed)
```

### Backend Services: Runtime Secrets

```
OpenShift Secret (managed in OpenShift)
    ↓
GitHub Actions (retrieves secret with oc get)
    ↓
helm install --set database.userApiPassword="..."
    ↓
Helm values receive the secrets
    ↓
Templates pass values as pod environment variables
    ↓
Running container reads env vars from its environment
```

## Setup

### Step 1: Verify Secrets in OpenShift

List existing secrets in your namespace:

```bash
# Login to OpenShift
oc login --token=<token> --server=<server>

# List all secrets
oc get secrets -n <namespace>

# View a specific secret
oc describe secret conservation-tool-db -n <namespace>

# Get a secret value
oc get secret conservation-tool-db -o jsonpath='{.data.api-password}' | base64 -d
```

You should have secrets like:
- `conservation-tool-db` (contains: api-password, prefect-password, admin-password, host, etc.)
- `conservation-tool-prefect` (contains: database-url)
- `conservation-tool-storage` (contains: access-key, secret-key, url)
- `conservation-tool-keycloak` (contains: admin-password, client-secret, host)
- `conservation-tool-frontend` (contains: prefect-api-url, api-host, zarr-store-path, etc.)

### Step 2: Update Your Helm Values Files

Backend services only need placeholders for runtime secrets:

```yaml
# helm/conservation-tool/values-dev.yaml

database:
  host: ""  # Will be filled at runtime by GitHub Actions
  port: 5432
  name: "conservation_tool_dev"
  userApi: ""  # Will be filled at runtime
  userApiPassword: ""  # Will be filled at runtime
  userPrefect: ""  # Will be filled at runtime
  userPrefectPassword: ""  # Will be filled at runtime
  admin: ""  # Will be filled at runtime
  adminPassword: ""  # Will be filled at runtime
  schema: "public"

prefect:
  databaseUrl: ""  # Will be filled at runtime

objectStorage:
  url: ""  # Will be filled at runtime
  accessKeyId: ""  # Will be filled at runtime
  secretKeyId: ""  # Will be filled at runtime
  bucketName: "conservation-tool-dev"
  keyPrefix: "dev/"

keycloak:
  host: ""  # Will be filled at runtime
  realm: "conservation-dev"
  adminUsername: ""  # Will be filled at runtime
  adminPassword: ""  # Will be filled at runtime
  apiTokenUrl: "http://keycloak-dev:8080/auth/realms/conservation-dev/protocol/openid-connect/token"
  apiClientId: "conservation-api"
  apiClientSecret: ""  # Will be filled at runtime
  apiHost: "keycloak-dev"
  apiEnvironment: "dev"

# Frontend doesn't need secrets here - they're baked into the image
```

```yaml

## OpenShift Secrets Required

Create these secrets in each OpenShift namespace:

### Frontend Secrets

```bash
oc create secret generic conservation-tool-frontend \
  --from-literal=prefect-api-url="http://api.dev.example.com:4200/api" \
  --from-literal=api-host="api.dev.example.com" \
  --from-literal=api-port="5200" \
  --from-literal=zarr-store-path="/data/output.zarr" \
  -n <namespace>
```

### Backend Secrets

```bash
oc create secret generic conservation-tool-db \
  --from-literal=host="postgres-dev.default.svc.cluster.local" \
  --from-literal=api-username="api_user" \
  --from-literal=api-password="api_secret_123" \
  --from-literal=prefect-username="prefect_user" \
  --from-literal=prefect-password="prefect_secret_456" \
  --from-literal=admin-username="admin" \
  --from-literal=admin-password="admin_secret_789" \
  -n <namespace>

oc create secret generic conservation-tool-prefect \
  --from-literal=database-url="postgresql://prefect_user:prefect_secret_456@postgres-dev:5432/prefect" \
  -n <namespace>

oc create secret generic conservation-tool-storage \
  --from-literal=url="http://minio:9000" \
  --from-literal=access-key="minioadmin" \
  --from-literal=secret-key="minioadmin" \
  -n <namespace>

oc create secret generic conservation-tool-keycloak \
  --from-literal=host="keycloak-dev" \
  --from-literal=admin-username="admin" \
  --from-literal=admin-password="keycloak_secret" \
  --from-literal=client-secret="client_secret_123" \
  -n <namespace>
```

## Key Differences

### Frontend

- ✅ Secrets baked into Docker image at build time
- ✅ Static files contain hardcoded values
- ✅ Cannot change without rebuilding image
- ✅ Extracted: `docker build --build-arg VITE_PREFECT_API_URL="..."`

### Backend Services

- ✅ Secrets passed at runtime via Helm
- ✅ Environment variables injected into containers
- ✅ Can change without rebuilding image
- ✅ Extracted: `helm install --set database.userApiPassword="..."`

## Troubleshooting

### Check if secrets exist in OpenShift

```bash
oc get secrets -n <namespace>
oc get secret conservation-tool-db -n <namespace> -o yaml
```

### Extract a secret value manually

```bash
oc get secret conservation-tool-db -o jsonpath='{.data.api-password}' | base64 -d
```

### Check frontend build arguments

In GitHub Actions logs, look for the "Build and push frontend image" step to verify build args were passed correctly.

### Check backend runtime environment variables

```bash
# See what environment variables are in a running pod
oc exec pod/<pod-name> -n <namespace> -- env | grep DB_

# View pod logs for any secret-related errors
oc logs pod/<pod-name> -n <namespace>
```

## Workflow Summary

1. **Developer** commits code changes to main
2. **GitHub Actions build-and-push** workflow runs:
   - For frontend: Extracts secrets, bakes into Docker image during build
   - For backend: Just builds image (no secrets)
3. **GitHub Actions deploy** job runs:
   - Extracts backend secrets from OpenShift
   - Passes them to Helm install via `--set` flags
   - Backend pods receive secrets as environment variables
4. **All secrets stay in OpenShift** - Single source of truth
5. **Frontend** has hardcoded config (can only change by rebuilding)
6. **Backend** can change secrets without rebuilding (just redeploy Helm)