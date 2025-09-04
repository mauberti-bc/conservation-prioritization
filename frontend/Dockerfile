# ---------- Build Stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source files and build the frontend
COPY . .
RUN yarn build

# ---------- Production Stage ----------
FROM caddy:2-alpine

# Create caddy user with specific UID for OpenShift compatibility
RUN addgroup -g 1001 -S caddy && adduser -u 1001 -S -G caddy caddy

# Remove capabilities that cause permission issues on OpenShift
RUN setcap -r /usr/bin/caddy

# Set up working directory that we own
WORKDIR /app
RUN chown -R caddy:caddy /app

# Copy built static files to our app directory
COPY --from=build --chown=caddy:caddy /app/build ./public

# Copy the Caddyfile to our app directory
COPY --chown=caddy:caddy Caddyfile ./Caddyfile

# Switch to non-root user
USER 1001

# Run Caddy from our working directory using relative paths
CMD ["caddy", "run", "--config", "./Caddyfile"]