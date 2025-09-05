# ---------- Build Stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# ---------- Production Stage ----------
FROM caddy:2-alpine

# Remove capabilities that cause permission issues on OpenShift
RUN setcap -r /usr/bin/caddy

# Create directories that Caddy needs with wide permissions
# OpenShift will remap the ownership anyway
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

# Use a different approach for the CMD to handle potential permission issues
CMD ["caddy", "run", "--config", "/app/Caddyfile"]