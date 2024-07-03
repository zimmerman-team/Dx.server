FROM node:16.19.1-alpine3.17

# For development add /bin/bash
RUN apk update && apk add bash

# Set up the server directory
WORKDIR /app
COPY . /app
RUN mkdir -p /app/dx.backend
# Ensure .env is available for the execSync index of the chart rendering
RUN echo "PARSED_DATA_FILES_PATH='/app/dx.backend/parsed-data-files/'" > .env
# Install yarn dependencies
RUN yarn global add pm2
RUN yarn install
RUN yarn build
# Yarn migrate is run from `yarn docker`

# APP LOG DIRECTORY FROM pm2.config.js
RUN mkdir -p /home/zim/app-logs/the-data-explorer-api

# Run `yarn docker` to build, migrate and run the server with pm2.
CMD ["yarn", "docker"]
