# ########################################################################################################
# This DockerFile is used for local development (via compose.yml) only.
# ########################################################################################################

FROM node:22.12.0

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

# Copy yarn.lock and package.json to leverage Docker cache
COPY yarn.lock package.json ./

# Install dependencies with yarn, including dev dependencies
RUN yarn install --frozen-lockfile

ENV PATH ${HOME}/node_modules/.bin/:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH

# Copy the rest of the files
COPY . ./

VOLUME ${HOME}

# start app with live reload
CMD ["yarn", "dev"]
