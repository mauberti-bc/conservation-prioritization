# Declare build args globally so they can be passed into all stages
ARG VITE_NODE_ENV
ARG VITE_NODE_OPTIONS
ARG VITE_PREFECT_API_URL
ARG VITE_ZARR_STORE_PATH

# ---------- Build Stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# ---------- Production Stage ----------
FROM caddy:2-alpine

# Re-declare args in this stage to receive values
ARG VITE_NODE_ENV
ARG VITE_NODE_OPTIONS
ARG VITE_PREFECT_API_URL
ARG VITE_ZARR_STORE_PATH

# Set environment variables for runtime inside final image
ENV VITE_NODE_ENV=$VITE_NODE_ENV
ENV VITE_NODE_OPTIONS=$VITE_NODE_OPTIONS
ENV VITE_PREFECT_API_URL=$VITE_PREFECT_API_URL
ENV VITE_ZARR_STORE_PATH=$VITE_ZARR_STORE_PATH

# Remove capabilities that cause permission issues on OpenShift
RUN setcap -r /usr/bin/caddy

# Create directories that Caddy needs with wide permissions
RUN mkdir -p /data/caddy/locks /config/caddy /tmp && \
    chmod -R 777 /data/caddy /config/caddy /tmp

# Set working directory
WORKDIR /app

# Copy built static files
COPY --from=build /app/build ./public

# Copy the Caddyfile
COPY Caddyfile ./Caddyfile

# Make sure the app directory is readable
RUN chmod -R 755 /app

CMD ["caddy", "run", "--config", "/app/Caddyfile"]
