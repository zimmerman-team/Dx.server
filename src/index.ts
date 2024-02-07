import {RestBindings} from '@loopback/rest';
import {ApiApplication, ApplicationConfig} from './application';
import {
  LoggingBindings,
  LoggingComponent,
  WINSTON_TRANSPORT,
} from '@loopback/logging';
import {extensionFor} from '@loopback/core';
import {LogErrorProvider} from './config/logger/log-error.provider';
import {fileTransport} from './config/logger/transport';
export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new ApiApplication(options);
  await app.boot();
  await app.migrateSchema();
  await app.start();
  app.bind(RestBindings.REQUEST_BODY_PARSER_OPTIONS).to({limit: '50mb'});
  app.configure(LoggingBindings.COMPONENT).to({
    enableFluent: false, // default to true
    enableHttpAccessLog: false, // default to true
  });

  app.component(LoggingComponent);

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  console.log(`Try ${url}/ping`);

  app
    .bind('logging.winston.transports.file')
    .to(fileTransport)
    .apply(extensionFor(WINSTON_TRANSPORT));

  // Log errors through provider
  app.bind(RestBindings.SequenceActions.LOG_ERROR).toProvider(LogErrorProvider);

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 4200),
      host: process.env.HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
