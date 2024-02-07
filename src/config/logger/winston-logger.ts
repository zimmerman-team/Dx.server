import winston from 'winston';
const {combine, timestamp, json} = winston.format;
export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({
      filename: './src/logging/info.log',
      level: 'error',
    }),
  ],
});
