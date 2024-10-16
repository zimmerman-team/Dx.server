# The Data Explorer API

---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/globalfund/data-explorer-server/blob/main/LICENSE.MD) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=globalfund_data-explorer-server&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=globalfund_data-explorer-server) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=globalfund_data-explorer-server&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=globalfund_data-explorer-server) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=globalfund_data-explorer-server&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=globalfund_data-explorer-server)

## What is the Data Explorer API?

## About the project

- Website: <a href="https://data.theglobalfund.org" target="_blank">data.theglobalfund.org</a>
- Authors: <a href="https://www.zimmerman.team/" target="_blank">Zimmerman</a>
- Github Repo:
  - Frontend: <a href="https://github.com/globalfund/data-explorer-client" target="_blank">https://github.com/globalfund/data-explorer-client</a>
  - Backend: <a href="https://github.com/globalfund/data-explorer-server" target="_blank">https://github.com/globalfund/data-explorer-server</a>

## Mapping process

Information about the data/logic mapping process can be found in [src/config/README.md](./src/config/README.md)

## Prerequisites

In order to use the Data Explorer Data Themes API, you need to install <a href="https://www.mongodb.com/docs/manual/installation/">MongoDB</a>.

The default database configuration can be found in [src/application.ts](./src/application.ts)

```js
const dbHost = process.env.MONGO_HOST ?? 'localhost';
const dbPort = process.env.MONGO_PORT ?? 27017;
const dbUser = process.env.MONGO_USERNAME ?? '';
const dbPass = process.env.MONGO_PASSWORD ?? '';
const database = process.env.MONGO_DB ?? 'the-data-explorer-db';
const authSource = process.env.MONGO_AUTH_SOURCE ?? '';
```

If you want to use different configuration variables then add them as environment variables

```txt
MONGO_HOST=<mongoDB host>
MONGO_PORT=<mongoDB port>
MONGO_USERNAME=<mongoDB username>
MONGO_PASSWORD=<mongoDB password>
MONGO_DB=<mongoDB name>
MONGO_AUTH_SOURCE=<mongoDB authentication source>
ALTERNATIVE_DATASOURCE_BASE=<Base URL to a different datasource, to be appended with the dataset identifier, for example "https://my.odata.source/data/dx">
DX_BACKEND_DIR=<directory where the DX backend runs, ending in a />
DX_BACKEND_URL=<URL to DX Backend, localhost would be http://localhost:4004>
PARSED_DATA_FILES_PATH=<directory where the parsed data files are stored>
```

## Install dependencies

Whenever dependencies in `package.json` are changed, run the following command:

```sh
yarn install
```

## Migrate DB models

Whenever database models in `src/models` are changed, run the following command:

```sh
yarn migrate
```

## Run the application in development mode

```sh
yarn dev
```

Open http://localhost:4200 in your browser. Changes will be reflected once you save them.

## Build and deploy with pm2

```sh
yarn deploy
```

## Fix code style and formatting issues

```sh
yarn run lint
```

To automatically fix such issues:

```sh
yarn run lint:fix
```

## Learn More

This project is created with [LoopBack v4](https://loopback.io).

To learn more about LoopBack v4, check out the [LoopBack v4 documentation](https://loopback.io/doc/en/lb4).

## How should I contribute?

- As we use semantic-release for automated git releases your commits must comply with the following commit types:

```
feat: A new feature
fix: A bug fix
docs: Documentation only changes
style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
refactor: A code change that neither fixes a bug nor adds a feature
perf: A code change that improves performance
test: Adding missing or correcting existing tests
chore: Changes to the build process or auxiliary tools and libraries such as documentation generation
```

- Always try to reference issues in commit messages or pull requests ("related to #614", "closes #619" and etc.).
- Avoid huge code commits where the difference can not even be rendered by browser based web apps (Github for example). Smaller commits make it much easier to understand why and how the changes were made, why (if) it results in certain bugs and etc.
- If there's a reason to commit code that is commented out (there usually should be none), always leave a "FIXME" or "TODO" comment so it's clear for other developers why this was done.
- Automatic code quality / testing checks (continuous integration tools) are implemented to check all these things automatically when pushing / merging new branches. Quality is the key!
