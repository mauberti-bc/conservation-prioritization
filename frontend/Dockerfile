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

# Create caddy user and group with specific UID for OpenShift compatibility
RUN addgroup -g 1001 -S caddy && adduser -u 1001 -S -G caddy caddy

# Remove capabilities and make caddy executable by any user
RUN setcap -r /usr/bin/caddy && \
    chmod 755 /usr/bin/caddy

# Create necessary directories with proper permissions
RUN mkdir -p /usr/share/caddy /etc/caddy /var/lib/caddy /config /data && \
    chown -R caddy:caddy /usr/share/caddy /etc/caddy /var/lib/caddy /config /data && \
    chmod -R 755 /usr/share/caddy /etc/caddy /var/lib/caddy /config /data

# Copy built static files to Caddy's web root
COPY --from=build --chown=caddy:caddy /app/build /usr/share/caddy

# Copy the Caddyfile from the build context
COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile

# Switch to non-root user
USER 1001

# Use a more OpenShift-friendly command that doesn't require privileged execution
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]