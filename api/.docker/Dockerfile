########################################################################################################
# This Dockerfile is used for local development (via compose.yml) only.
########################################################################################################

FROM node:22

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

# Enable Corepack + Yarn 4
RUN corepack enable && corepack prepare yarn@4.11.0 --activate

# Copy Yarn configuration files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/

# Install all dependencies (including dev)
RUN yarn install --immutable

# Install `tsx` as a dev dependency
RUN yarn add -D tsx

# Ensure Yarn/Node binaries are in PATH
ENV PATH="${HOME}/node_modules/.bin:${PATH}"

# Copy application code AFTER dependencies for better caching
COPY . ./

# Mount code directory
VOLUME ${HOME}

# Start API with hot reload
CMD ["yarn", "dev"]
