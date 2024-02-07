import {WinstonTransports, format} from '@loopback/logging';

export const fileTransport = new WinstonTransports.File({
  filename: './src/logging/dx_server.log',
  maxsize: 1000000, // 1MB
  handleExceptions: true,
  rotationFormat: () => {},
  level: 'debug',
  format: format.combine(
    format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    format.prettyPrint(),
    format.printf(
      info =>
        `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message} ${
          info.stack ? info.stack : ''
        }`,
    ),
  ),
});
