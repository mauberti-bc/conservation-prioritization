# Declare build args globally so they can be passed into build stage
ARG VITE_NODE_ENV
ARG VITE_NODE_OPTIONS
ARG VITE_PREFECT_API_URL
ARG VITE_ZARR_STORE_PATH

# ---------- Build Stage ----------
FROM node:22-alpine AS build

RUN corepack enable && \
    corepack prepare yarn@4.11.0 --activate

WORKDIR /app

ARG VITE_NODE_ENV
ARG VITE_NODE_OPTIONS
ARG VITE_PREFECT_API_URL
ARG VITE_ZARR_STORE_PATH

ENV VITE_NODE_ENV=$VITE_NODE_ENV
ENV VITE_NODE_OPTIONS=$VITE_NODE_OPTIONS
ENV VITE_PREFECT_API_URL=$VITE_PREFECT_API_URL
ENV VITE_ZARR_STORE_PATH=$VITE_ZARR_STORE_PATH

COPY package.json yarn.lock .yarnrc.yml ./
# COPY .yarn/ .yarn/

RUN yarn install --immutable

COPY . .

RUN yarn build

# ---------- Production Stage ----------
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7070

# Copy the runtime server
COPY server ./server

# Copy built frontend assets
COPY --from=build /app/build ./build

# OpenShift-friendly permissions
RUN mkdir -p /tmp && chmod -R 777 /tmp && \
    chmod -R 755 /app

EXPOSE 7070

CMD ["node", "/app/server/index.mjs"]