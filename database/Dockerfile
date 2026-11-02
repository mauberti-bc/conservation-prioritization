# ########################################################################################################
# This DockerFile is used for Openshift deployments only.
# ########################################################################################################

ARG POSTGRES_VERSION=17-bookworm

FROM postgres:$POSTGRES_VERSION

# read env variables
ARG TZ=America/Vancouver
ARG POSTGIS_VERSION=3

ENV PORT=5432

# install postgis packages
# Update and install in one layer so installs never use a stale package index.
RUN mkdir -p /opt/apps \
    && apt-get -qq update \
    && apt-get -qq install -y --no-install-recommends \
        postgresql-$PG_MAJOR-postgis-$POSTGIS_VERSION \
        postgresql-$PG_MAJOR-postgis-$POSTGIS_VERSION-scripts \
        postgresql-$PG_MAJOR-pgrouting \
        postgresql-$PG_MAJOR-pgrouting-scripts \
        postgresql-server-dev-$PG_MAJOR \
        pgbadger pg-activity wget unzip nano \
    && apt-get -qq purge -y --auto-remove postgresql-server-dev-$PG_MAJOR \
    && apt-get -qq autoremove -y \
    && apt-get -qq clean \
    && rm -rf /var/lib/apt/lists/*

# set time zone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# copy postgis init script to docker init directory
RUN mkdir -p /docker-entrypoint-initdb.d
COPY ./.docker/db/create_postgis.sql /docker-entrypoint-initdb.d/postgis.sql

EXPOSE $PORT

# Run as the image's built-in postgres user rather than root.
USER postgres

CMD ["postgres"]
