# ########################################################################################################
# This DockerFile is used for local development (via compose.yml) only.
# ########################################################################################################
FROM node:22.12.0

# Enable Corepack as root, since it links shims into /usr/local/bin
RUN corepack enable

ENV HOME=/opt/app-root/src
RUN mkdir -p $HOME && chown node:node $HOME
WORKDIR $HOME

# Run as the node image's built-in non-root user
USER node

# Prepare Yarn 4.11.0 in the non-root user's cache
RUN corepack prepare yarn@4.11.0 --activate

# Copy Yarn configuration and lock files to leverage Docker cache
COPY --chown=node:node package.json yarn.lock .yarnrc.yml ./

# Install dependencies with Yarn 4.11.0
RUN yarn install --immutable

ENV PATH ${HOME}/node_modules/.bin/:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH

# Copy the rest of the files
COPY --chown=node:node . ./

VOLUME ${HOME}

# start app with live reload
CMD ["yarn", "dev"]