########################################################################################################
# This Dockerfile is used for OpenShift deployments only.
########################################################################################################

#####################################################
# Stage 1: Build the dist folder
#####################################################

FROM node:22 AS stage_1

USER 0

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME && \
    chgrp -R 0 $HOME && \
    chmod -R g+rwX $HOME

WORKDIR $HOME

# Enable Corepack + Yarn 4
RUN corepack enable && corepack prepare yarn@4.11.0 --activate

# Copy Yarn files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/

# Install all deps (including dev)
RUN yarn install --immutable

# Copy application files
COPY . ./

# Build API dist
RUN yarn build

#####################################################
# Stage 2: Install production dependencies
#####################################################

FROM node:22 AS stage_2

USER 0

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME && \
    chgrp -R 0 $HOME && \
    chmod -R g+rwX $HOME

WORKDIR $HOME

# Enable Corepack + Yarn 4
RUN corepack enable && corepack prepare yarn@4.11.0 --activate

# Copy Yarn config
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/

# Install only prod deps
RUN yarn install --immutable --mode=production

#####################################################
# Stage 3: Final Image
#####################################################

FROM node:22 AS stage_3

USER 0

ENV HOME=/opt/app-root/src

# Create src folder for built dist
RUN mkdir -p $HOME/src && \
    chgrp -R 0 $HOME && \
    chmod -R g+rwX $HOME

WORKDIR $HOME

# Copy built dist output
COPY --from=stage_1 ${HOME}/dist/ ${HOME}/src/

# Copy production node_modules
COPY --from=stage_2 ${HOME}/node_modules ${HOME}/node_modules
COPY --from=stage_2 ${HOME}/package.json ${HOME}/package.json

# Set PATH for Yarn binaries (not required but safe)
ENV PATH="${HOME}/node_modules/.bin:${PATH}"

# Application port
EXPOSE 6100

USER 1001  # OpenShift arbitrary UID

CMD ["node", "src/app.js"]
