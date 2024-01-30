import {Provider} from '@loopback/context';
import {inject} from '@loopback/core';
import {LoggingBindings, WinstonLogger} from '@loopback/logging';
import {LogError, Request} from '@loopback/rest';
import {createLogger, Logger} from 'winston';

export class LogErrorProvider implements Provider<LogError> {
  constructor(
    @inject(LoggingBindings.WINSTON_LOGGER) protected logger: WinstonLogger,
  ) {
    createLogger();
  }

  value(): LogError {
    return (err, statusCode, req) => this.action(err, statusCode, req);
  }

  action(err: Error, statusCode: number, req: Request) {
    if (statusCode < 500) {
      return;
    }

    this.logger.error(
      `HTTP ${statusCode} on ${req.method} ${req.url}: ${err.stack ?? err}`,
      {},
    );
  }
}
