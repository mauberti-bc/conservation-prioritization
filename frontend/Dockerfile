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

# Copy built static files to Caddy's web root
COPY --from=build /app/build /usr/share/caddy

# Copy the Caddyfile from the build context
COPY Caddyfile /etc/caddy/Caddyfile

# Run Caddy using the provided config
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
