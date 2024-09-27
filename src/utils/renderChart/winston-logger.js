import winston from 'winston';
const {combine, timestamp, prettyPrint, printf} = winston.format;
export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  
  format: combine(
    timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    prettyPrint(),
    printf(
      info =>
        `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message} ${
          info.stack ? info.stack : ''
        }`,
    ),
  ),
  transports: [
    new winston.transports.File({
      filename: './logging/dx_server.log',
      level: 'debug',
      maxsize: 1000000, // 1MB
    }),
  ],
});
