########################################################################################################
# This Dockerfile is used for local development (via compose.yml) only.
########################################################################################################

FROM node:22

ENV HOME=/opt/app-root/src

# Enable Corepack as root, since it links shims into /usr/local/bin
RUN corepack enable

RUN mkdir -p $HOME && chown node:node $HOME

WORKDIR $HOME

# Run as the node image's built-in non-root user
USER node

# Prepare Yarn 4 in the non-root user's cache
RUN corepack prepare yarn@4.11.0 --activate

# Copy Yarn configuration files
COPY --chown=node:node package.json yarn.lock .yarnrc.yml ./
COPY --chown=node:node .yarn/ .yarn/

# Install all dependencies (including dev)
RUN yarn install --immutable

# Ensure Yarn/Node binaries are in PATH
ENV PATH="${HOME}/node_modules/.bin:${PATH}"

# Copy application code AFTER dependencies for better caching
COPY --chown=node:node . ./

# Mount code directory
VOLUME ${HOME}

# Start API with hot reload
CMD ["yarn", "dev"]
