# Conservation Prioritization Tool

This project is a containerized full-stack application composed of:

- Frontend (Vite + Node)
- API (Node backend)
- PostgreSQL + PostGIS database
- Prefect server + worker (workflow orchestration)
- MinIO (S3-compatible object storage)
- Database setup service
- MinIO setup service

All services are orchestrated with Docker Compose and managed via a Makefile for convenience.

---

# Prerequisites

You must have the following installed:

- Docker
- Make
- Chocolatey (Windows only, for installing Make)
- (Optional for local development) Node.js with Corepack enabled

## Windows Setup

Install Chocolatey (if not already installed):

See: https://chocolatey.org/install

Then install Make:

`choco install make`

Verify installation:

`make --version`

## macOS

`brew install make`

## Linux

`sudo apt install make`

## Verify Required Tools

`docker --version`  
`docker compose version`  
`make --version`

---

# Environment Setup

## 1. Create Your `.env` File

Copy the default Docker environment file:

`make setup`

This copies:

`env_config/env.docker → .env`

You may be prompted before overwriting.

## 2. Validate Environment Variables

`make check-env`

This checks that your `.env` file contains all required variables.

# Node.js Version Requirement (Local Development)

If you are running any part of this project outside Docker (e.g., frontend or API locally), you must use **Node.js 22**.

Using other Node versions may cause dependency or build failures.

## Recommended: Use NVM (Node Version Manager)

We strongly recommend using **nvm** to manage Node versions.

---

## Install NVM

### macOS / Linux

Install via curl:

`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`

Then restart your terminal or run:

`source ~/.nvm/nvm.sh`

Verify installation:

`nvm --version`

---

### Windows

Install **nvm-windows**:

https://github.com/coreybutler/nvm-windows/releases

Download and run the installer, then restart your terminal.

Verify installation:

`nvm version`

---

## Install and Use Node 22

Once nvm is installed:

`nvm install 22`  
`nvm use 22`

Verify:

`node --version`

It should print something like:

`v22.x.x`

---

## Optional: Set Node 22 as Default

To automatically use Node 22 in new terminals:

`nvm alias default 22`

---

## After Switching Node Versions

Enable Corepack (required for Yarn 4):

`corepack enable`

Then install dependencies:

`make install`

---

If you encounter issues, ensure:

- You are using Node 22 (`node --version`)
- Corepack is enabled
- You restarted your terminal after installing nvm

---

# Running the Application

You can run everything together or start specific components.

---

# Run Everything (Recommended)

Build and start all required services:

`make all`

This builds and runs:

- frontend
- db
- db_setup
- prefect_server
- prefect_deploy
- prefect_worker

---

# Run Web Application (Frontend + API + DB)

`make web`

Build only:

`make build-web`

Run only:

`make run-web`

Services started:

- frontend
- api
- db
- db_setup

---

# Run Backend Only

`make backend`

Services started:

- api
- db
- db_setup

---

# Run Frontend Only

`make frontend`

---

# Run Prefect (Workflow Engine)

`make prefect`

Services started:

- prefect_server
- prefect_deploy
- prefect_worker

---

# Run MinIO (Object Storage)

`make minio`

This starts:

- minio
- minio_setup

MinIO Console:  
`http://localhost:9001`

MinIO API:  
`http://localhost:9000`

Credentials come from:

- OBJECT_STORE_ACCESS_KEY_ID
- OBJECT_STORE_SECRET_KEY_ID

---

# Database Setup Only

`make db-setup`

---

# Install Node Dependencies (Optional Local Development)

If running parts of the project outside Docker:

`make install`

This uses Corepack and Yarn 4.

---

# Viewing Logs

All logs:

`make log`

Frontend logs only:

`make log-frontend`

Default log tail size:

`--tail 2000`

Override:

`make log args="--tail 500"`

---

# Stopping Services

Stop all containers:

`make close`

---

# Cleaning Docker Environment

Remove containers, images, volumes, and orphans:

`make clean`

Warning: This removes volumes. Database data will be deleted.

---

# Full Docker Reset (Dangerous)

`make prune`

This deletes all Docker artifacts on your machine.

---

# Service Ports

| Service           | Port                  |
|------------------|-----------------------|
| Frontend        | ${FRONTEND_PORT}       |
| API             | ${API_PORT}            |
| Prefect API     | 4200                   |
| Prefect UI      | 8080                   |
| PostgreSQL      | ${DB_PORT}             |
| MinIO API       | 9000                   |
| MinIO Console   | 9001                   |
| Prefect Worker  | 8787                   |

---

# Architecture Overview

Frontend  →  API  →  PostgreSQL  
                   ↘  
                    Prefect Server → Prefect Worker  
                   ↘  
                    MinIO (Object Storage)

---

# Service Responsibilities

## Frontend
- Vite-based UI
- Reads API and Prefect endpoints from environment variables

## API
- Connects to PostgreSQL
- Authenticates via Keycloak
- Communicates with Prefect
- Reads and writes to MinIO

## Database
- PostgreSQL with PostGIS
- Auto-initialized via db_setup

## Prefect
- prefect_server: orchestration API
- prefect_deploy: registers flows
- prefect_worker: executes workflows

## MinIO
- S3-compatible object storage
- Buckets automatically created on startup

---

# Common Development Workflows

## Rebuild Everything After Changes

`make clean`  
`make all`

## Rebuild Backend Only

`make build-backend`  
`make run-backend`

## Reset Database Only

`docker compose down -v`  
`make web`

---

# Persistent Volumes

- postgres → Database data
- minio_data → Object storage data
- zarr_data → Bound to ./workflows/data

---

# Important Environment Variables

Ensure the following are correctly set in `.env`:

- Database credentials
- Keycloak credentials
- Prefect API URL
- Object store credentials
- API host and port
- Frontend port

---

# Health Checks

- Database: `pg_isready`
- Prefect: `/api/health`
- MinIO: `mc ready`

Containers wait for dependencies to become healthy before starting.

---

# Manual Docker Commands (Without Make)

Build:

`docker compose build`

Run:

`docker compose up -d`

Stop:

`docker compose down`

---

# Recommended Startup Order (Manual)

If not using Make, start services in this order:

1. db
2. db_setup
3. minio
4. api
5. prefect_server
6. prefect_deploy
7. prefect_worker
8. frontend

# Prefect (Workflow Orchestration) – Prefect 3

This project uses **Prefect 3** to manage workflows such as data processing, object storage operations, or geospatial tasks. Prefect 3 uses a simplified architecture compared to Prefect 2, with **server, deployments, and workers**.

---

## How Prefect Works

### 1. Prefect Server

`prefect_server` provides the orchestration API and a dashboard for monitoring flows. It manages flow states, logs, and metadata. All workers and clients communicate with this server.

Health check endpoint:  
`http://localhost:4200/api/health`

---

### 2. Deploy Flows (`prefect_deploy`)

Before workers can execute tasks, flows must be **registered with the Prefect server**. This is done through deployments:

- A **deployment** links a flow to a schedule, parameters, and an execution environment.
- Deployments tell Prefect **what flows exist and how to run them**.

`prefect_deploy` service automatically registers all flows defined in the project when started.

---

### 3. Workers (`prefect_worker`)

Workers **watch queues** for scheduled flow runs:

- Workers continuously poll the Prefect server for new flow runs.
- When a flow run is available, the worker executes it in its environment.
- Multiple workers can run in parallel, allowing **scalable execution**.

Default worker port: `8787`