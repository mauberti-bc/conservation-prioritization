# Conservation Prioritization Tool

This project is a containerized full-stack application for conservation prioritization, orchestrated with Docker Compose and managed via a Makefile.

## Architecture Overview

```
Frontend (Vite + Node)
    ↓
API (Node backend)
    ↓
PostgreSQL + PostGIS ← → Prefect Server → Prefect Worker
    ↓
MinIO (S3-compatible object storage)
```

### Components

- **Frontend**: Vite-based UI that reads API and Prefect endpoints from environment variables
- **API**: Node backend that connects to PostgreSQL, authenticates via Keycloak, communicates with Prefect, and interfaces with MinIO
- **Database**: PostgreSQL with PostGIS extension, auto-initialized via db_setup service
- **Prefect Server**: Orchestration API and dashboard for monitoring workflows
- **Prefect Worker**: Executes scheduled workflow tasks
- **MinIO**: S3-compatible object storage with automatic bucket creation

---

## Prerequisites

### Required Software

You must have the following installed:

- **Docker**
- **Make**
- **Chocolatey** (Windows only, for installing Make)
- **Node.js with Corepack enabled** (optional, for local development only)

### Installation by Platform

#### Windows

1. Install Chocolatey (if not already installed):
   - See: https://chocolatey.org/install

2. Install Make:
   ```bash
   choco install make
   ```

3. Verify installation:
   ```bash
   make --version
   ```

#### macOS

```bash
brew install make
```

#### Linux

```bash
sudo apt install make
```

### Verify Required Tools

```bash
docker --version
docker compose version
make --version
```

---

## Environment Setup

### 1. Create Your `.env` File

Copy the default Docker environment file:

```bash
make setup
```

This copies `env_config/env.docker` → `.env`. You may be prompted before overwriting.

### 2. Validate Environment Variables

```bash
make check-env
```

This checks that your `.env` file contains all required variables.

### Important Environment Variables

Ensure the following are correctly set in `.env`:

- Database credentials
- Keycloak credentials
- Prefect API URL
- Object store credentials (ACCESS_KEY_ID, SECRET_KEY_ID)
- API host and port
- Frontend port

---

## Node.js Setup (Local Development Only)

**Note**: This section is only required if you plan to run the frontend or API outside of Docker.

### Version Requirement

This project requires **Node.js 22**. Using other versions may cause dependency or build failures.

### Installing NVM (Recommended)

We strongly recommend using **nvm** (Node Version Manager) to manage Node versions.

#### macOS / Linux

1. Install via curl:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   ```

2. Restart your terminal or run:
   ```bash
   source ~/.nvm/nvm.sh
   ```

3. Verify installation:
   ```bash
   nvm --version
   ```

#### Windows

1. Install **nvm-windows**: https://github.com/coreybutler/nvm-windows/releases
2. Download and run the installer
3. Restart your terminal
4. Verify installation:
   ```bash
   nvm version
   ```

### Install and Use Node 22

```bash
nvm install 22
nvm use 22
```

Verify:
```bash
node --version
```

Expected output: `v22.x.x`

### Set Node 22 as Default (Optional)

To automatically use Node 22 in new terminals:

```bash
nvm alias default 22
```

### Enable Corepack

After switching to Node 22, enable Corepack (required for Yarn 4):

```bash
corepack enable
```

Then install dependencies:

```bash
make install
```

### Troubleshooting

If you encounter issues, ensure:

- You are using Node 22 (`node --version`)
- Corepack is enabled
- You restarted your terminal after installing nvm

---

## Python Workflow Environment (UV)

The `workflows` directory uses **uv** to manage Python dependencies and virtual environments, ensuring isolated and consistent execution.

### Installing UV

```bash
pip install uv
```

Verify installation:
```bash
uv --version
```

### Syncing Dependencies

Navigate to the `workflows` directory and sync dependencies:

```bash
cd workflows
uv sync
```

This will:
- Create a virtual environment (if one does not exist)
- Install all required Python packages
- Ensure your environment matches the project requirements

### Notes

- Ensure your Python version matches the project requirements (uv respects `.python-version` if present)
- If you encounter issues, verify that uv is installed in the correct Python environment
- You can integrate this step into your Makefile via the `make install-deps` target

---

## Running the Application

### Run Everything (Recommended)

Build and start all required services:

```bash
make all
```

Services started:
- frontend
- api
- db
- db_setup
- prefect_server
- prefect_deploy
- prefect_worker

### Run Specific Components

#### Web Application (Frontend + API + DB)

```bash
make web
```

Build only:
```bash
make build-web
```

Run only:
```bash
make run-web
```

Services started:
- frontend
- api
- db
- db_setup

#### Backend Only

```bash
make backend
```

Services started:
- api
- db
- db_setup

#### Frontend Only

```bash
make frontend
```

#### Prefect (Workflow Engine)

```bash
make prefect
```

Services started:
- prefect_server
- prefect_deploy
- prefect_worker

#### MinIO (Object Storage)

```bash
make minio
```

Services started:
- minio
- minio_setup

**Access Points:**
- MinIO Console: http://localhost:9001
- MinIO API: http://localhost:9000

Credentials from environment variables:
- `OBJECT_STORE_ACCESS_KEY_ID`
- `OBJECT_STORE_SECRET_KEY_ID`

#### Database Setup Only

```bash
make db-setup
```

#### Install Node Dependencies (Local Development)

If running parts of the project outside Docker:

```bash
make install
```

This uses Corepack and Yarn 4.

---

## Managing Services

### Viewing Logs

View all logs:
```bash
make log
```

View frontend logs only:
```bash
make log-frontend
```

Default log tail size: `--tail 2000`

Override tail size:
```bash
make log args="--tail 500"
```

### Stopping Services

Stop all containers:
```bash
make close
```

### Cleaning Docker Environment

Remove containers, images, volumes, and orphans:

```bash
make clean
```

**Warning**: This removes volumes. Database data will be deleted.

### Full Docker Reset (Dangerous)

```bash
make prune
```

**Warning**: This deletes all Docker artifacts on your machine.

---

## Service Ports

| Service           | Port                       |
|-------------------|----------------------------|
| Frontend          | `${FRONTEND_PORT}`         |
| API               | `${API_PORT}`              |
| PostgreSQL        | `${DB_PORT}`               |
| Prefect API       | 4200                       |
| Prefect UI        | 8080                       |
| Prefect Worker    | 8787                       |
| MinIO API         | 9000                       |
| MinIO Console     | 9001                       |

---

## Prefect Workflow Orchestration (Prefect 3)

This project uses **Prefect 3** to manage workflows such as data processing, object storage operations, and geospatial tasks.

### How Prefect Works

#### 1. Prefect Server

The `prefect_server` provides the orchestration API and dashboard for monitoring flows. It manages flow states, logs, and metadata.

**Health check endpoint**: http://localhost:4200/api/health

#### 2. Deploy Flows (`prefect_deploy`)

Before workers can execute tasks, flows must be **registered with the Prefect server** through deployments:

- A **deployment** links a flow to a schedule, parameters, and an execution environment
- Deployments tell Prefect **what flows exist and how to run them**
- The `prefect_deploy` service automatically registers all flows when started

#### 3. Workers (`prefect_worker`)

Workers **watch queues** for scheduled flow runs:

- Workers continuously poll the Prefect server for new flow runs
- When a flow run is available, the worker executes it in its environment
- Multiple workers can run in parallel for **scalable execution**

**Default worker port**: 8787

---

## Persistent Volumes

- **postgres**: Database data
- **minio_data**: Object storage data
- **zarr_data**: Bound to `./workflows/data`

---

## Health Checks

Services include health checks to ensure proper startup order:

- **Database**: `pg_isready`
- **Prefect**: `/api/health`
- **MinIO**: `mc ready`

Containers wait for dependencies to become healthy before starting.

---

## Common Development Workflows

### Rebuild Everything After Changes

```bash
make clean
make all
```

### Rebuild Backend Only

```bash
make build-backend
make run-backend
```

### Reset Database Only

```bash
docker compose down -v
make web
```

---

## Manual Docker Commands (Without Make)

If you prefer not to use Make:

### Build

```bash
docker compose build
```

### Run

```bash
docker compose up -d
```

### Stop

```bash
docker compose down
```

### Recommended Startup Order

If starting services manually, use this order:

1. db
2. db_setup
3. minio
4. api
5. prefect_server
6. prefect_deploy
7. prefect_worker
8. frontend

---

## Troubleshooting

### Node Version Issues

- Ensure you're using Node 22: `node --version`
- Enable Corepack: `corepack enable`
- Restart your terminal after installing nvm

### Docker Issues

- Verify Docker is running: `docker ps`
- Check service logs: `make log`
- Reset Docker environment: `make clean` then `make all`

### Database Connection Issues

- Ensure database is healthy: `docker compose ps`
- Check database logs: `docker compose logs db`
- Verify environment variables in `.env`

### Prefect Issues

- Check Prefect server health: http://localhost:4200/api/health
- View Prefect logs: `docker compose logs prefect_server`
- Ensure flows are deployed: `docker compose logs prefect_deploy`