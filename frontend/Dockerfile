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

# Remove capabilities that cause permission issues on OpenShift
RUN setcap -r /usr/bin/caddy

# Create caddy user and group
RUN addgroup -S caddy && adduser -S -G caddy caddy

# Copy built static files to Caddy's web root
COPY --from=build /app/build /usr/share/caddy

# Copy the Caddyfile from the build context
COPY Caddyfile /etc/caddy/Caddyfile

# Fix permissions so 'caddy' user can read the files
RUN chown -R caddy:caddy /usr/share/caddy /etc/caddy

USER caddy

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
