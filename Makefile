# ------------------------------------------------------------------------------
# Makefile -- Conservation Prioritization Tool
# ------------------------------------------------------------------------------

-include .env

export $(shell sed 's/=.*//' .env)

## ------------------------------------------------------------------------------
## Alias Commands - Logical groups for convenience
## ------------------------------------------------------------------------------

# Setup environment
setup: | setup-env check-env ## Copies default env.docker to .env
env: | setup-env check-env

# Web app and prefect
all: | build-all run-all

# Running web app parts
web: | build-web run-web
backend: | build-backend run-backend
frontend: | build-frontend run-frontend

# Prefect
prefect: | build-prefect run-prefect

db-setup: | check-env build-db-setup run-db-setup

clamav: | check-env build-clamav run-clamav

minio: | check-env run-minio

fix: | lint-fix format-fix
install: | install-deps

## ------------------------------------------------------------------------------
## Setup Commands
## ------------------------------------------------------------------------------

setup-env: ## Copy env.docker sample to .env (interactive)
	@echo "==============================================="
	@echo "Make: setup-env - copying env.docker to .env"
	@echo "==============================================="
	@cp -i env_config/env.docker .env

check-env: ## Warn if env vars missing in .env
	@echo "==============================================="
	@echo "Make: check-env - checking for missing env vars"
	@echo "==============================================="
	@awk -F '=' 'NR==FNR && !/^#/ && NF {a[$$1]; next} !/^#/ && NF && !($$1 in a)' .env env_config/env.docker | while read -r line; do echo "Warning: Missing value for $$line in .env"; done

## ------------------------------------------------------------------------------
## Install Commands
## ------------------------------------------------------------------------------

install-deps: ## Install dependencies using Corepack + Yarn
	@echo "==============================================="
	@echo "Make: install - installing dependencies"
	@echo "==============================================="
	@corepack enable
	@corepack prepare yarn@4.11.0 --activate
	@corepack yarn --version
	@corepack yarn install
	@corepack yarn --cwd api install
	@corepack yarn --cwd frontend install
	@corepack yarn --cwd database install

## ------------------------------------------------------------------------------
## Cleanup Commands
## ------------------------------------------------------------------------------

close: ## Stop all containers
	@echo "==============================================="
	@echo "Make: close - closing Docker containers"
	@echo "==============================================="
	@docker compose down

clean: ## Stop and remove containers, images, volumes, orphans
	@echo "==============================================="
	@echo "Make: clean - closing and cleaning Docker containers"
	@echo "==============================================="
	@docker compose down -v --rmi all --remove-orphans

prune: ## Delete ALL Docker artifacts (dangerous)
	@echo -n "Delete ALL docker artifacts? [y/n] " && read ans && [ $${ans:-n} = y ]
	@echo "==============================================="
	@echo "Make: prune - deleting all docker artifacts"
	@echo "==============================================="
	@docker system prune --all --volumes -f
	@docker volume prune --all -f

## ------------------------------------------------------------------------------
## Build and Run Backend + Web + Prefect
## ------------------------------------------------------------------------------

build-all: ## Build containers for all
	@echo "==============================================="
	@echo "Make: build-all - building all images"
	@echo "==============================================="
	@docker compose build frontend db db_setup prefect_server prefect_deploy prefect_worker

run-all: ## Run containers for all
	@echo "==============================================="
	@echo "Make: run-all - running all images"
	@echo "==============================================="
	@docker compose up -d frontend db db_setup prefect_server prefect_deploy prefect_worker

## ------------------------------------------------------------------------------
## Build and Run Backend + Web
## ------------------------------------------------------------------------------

build-web: ## Build containers for web
	@echo "==============================================="
	@echo "Make: build-web - building web images"
	@echo "==============================================="
	@docker compose build frontend db db_setup api

run-web: ## Run containers for web
	@echo "==============================================="
	@echo "Make: run-web - running web images"
	@echo "==============================================="
	@docker compose up -d frontend db db_setup api


## ------------------------------------------------------------------------------
## Build and Run Backend + Web
## ------------------------------------------------------------------------------

build-backend: ## Build containers for backend
	@echo "==============================================="
	@echo "Make: build-backend - building backend images"
	@echo "==============================================="
	@docker compose build api db db_setup

run-backend: ## Run containers for backend
	@echo "==============================================="
	@echo "Make: run-backend - running backend images"
	@echo "==============================================="
	@docker compose up -d api db db_setup



## ------------------------------------------------------------------------------
## Build and Run Frontend
## ------------------------------------------------------------------------------

build-frontend: ## Build containers for frontend
	@echo "==============================================="
	@echo "Make: build-frontend - building frontend images"
	@echo "==============================================="
	@docker compose build frontend

run-frontend: ## Run containers for frontend
	@echo "==============================================="
	@echo "Make: run-frontend - running frontend images"
	@echo "==============================================="
	@docker compose up -d frontend


## ------------------------------------------------------------------------------
## Build and Run Prefect
## ------------------------------------------------------------------------------

build-prefect: ## Build containers for prefect
	@echo "==============================================="
	@echo "Make: build-prefect - building prefect images"
	@echo "==============================================="
	@docker compose build prefect_server prefect_deploy prefect_worker

run-prefect: ## Run containers for prefect
	@echo "==============================================="
	@echo "Make: run-prefect - running prefect images"
	@echo "==============================================="
	@docker compose up -d prefect_server prefect_deploy prefect_worker


## ------------------------------------------------------------------------------
## Run MinIO
## ------------------------------------------------------------------------------

run-minio: ## Run MinIO + setup containers
	@echo "==============================================="
	@echo "Make: run-minio - running MinIO images"
	@echo "==============================================="
	@docker compose up -d minio minio_setup


## ------------------------------------------------------------------------------
## Docker logs
## ------------------------------------------------------------------------------

args ?= --tail 2000

log: ## Show logs for all containers
	@echo "==============================================="
	@echo "Running docker logs for all containers"
	@echo "==============================================="
	@docker compose logs -f $(args)

log-frontend: ## Logs for frontend container
	@echo "==============================================="
	@echo "Running docker logs for the frontend container"
	@echo "==============================================="
	@docker logs $(DOCKER_PROJECT_NAME)-frontend-$(DOCKER_NAMESPACE)-container -f $(args)


lint: ## Runs `npm lint` for all projects
	@echo "==============================================="
	@echo "Running /frontend lint"
	@echo "==============================================="
	@cd frontend && npm run lint && cd ..

lint-fix: ## Runs `npm run lint-fix ` for all projects
	@echo "==============================================="
	@echo "Running /frontend lint-fix"
	@echo "==============================================="
	@cd frontend && npm run lint-fix && cd ..
	
format: ## Runs `npm run format` for all projects
	@echo "==============================================="
	@echo "Running /frontend format"
	@echo "==============================================="
	@cd frontend && npm run format && cd ..
	
format-fix: ## Runs `npm run format-fix` for all projects
	@echo "==============================================="
	@echo "Running /frontend format-fix"
	@echo "==============================================="
	@cd frontend && npm run format-fix && cd ..
	
