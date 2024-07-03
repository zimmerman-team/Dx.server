import {Provider} from '@loopback/context';
import {LogError, Request} from '@loopback/rest';
import {createLogger, Logger} from 'winston';
import {winstonLogger as logger} from './winston-logger';
export class LogErrorProvider implements Provider<LogError> {
  constructor() {
    createLogger();
  }

  value(): LogError {
    return (err, statusCode, req) => this.action(err, statusCode, req);
  }

  action(err: Error, statusCode: number, req: Request) {
    if (statusCode < 500) {
      return;
    }

    logger.error(
      `HTTP ${statusCode} on ${req.method} ${req.url}: ${err.stack ?? err}`,
      {},
    );
  }
}
