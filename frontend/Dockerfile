# Build stage
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# Production stage
FROM caddy:2-alpine

# Copy the built static files to Caddy's www directory
COPY --from=build /app/build /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]

