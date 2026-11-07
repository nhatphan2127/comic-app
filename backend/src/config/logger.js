import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const logsDirectory = path.resolve(configDirectory, '../../logs');
fs.mkdirSync(logsDirectory, { recursive: true });

export function createLogFormat(dataset, loggerName) {
  return winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.timestamp({ format: () => new Date().toISOString() }),
    winston.format((info) => {
      const { level, message, timestamp, ...metadata } = info;
      const eventMetadata = metadata.event && typeof metadata.event === 'object' ? metadata.event : {};

      return {
        ...metadata,
        timestamp,
        log: { level },
        process: { pid: process.pid },
        labels: { app: 'comic-app' },
        thread: { name: 'main' },
        logger: loggerName,
        message: metadata.stack || message,
        service: { name: 'comic-app-backend' },
        event: { ...eventMetadata, dataset },
      };
    })(),
    winston.format.json(),
  );
}

const createLogger = (dataset, loggerName, filename) =>
  winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    silent: process.env.NODE_ENV === 'test',
    transports: [
      new winston.transports.Console({ format: createLogFormat(dataset, loggerName) }),
      new winston.transports.File({
        filename: path.join(logsDirectory, filename),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
        format: createLogFormat(dataset, loggerName),
      }),
    ],
  });

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  silent: process.env.NODE_ENV === 'test',
  transports: [
    new winston.transports.Console({ format: createLogFormat('application', 'comic-app.backend') }),
    new winston.transports.File({
      filename: path.join(logsDirectory, 'app.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format: createLogFormat('application', 'comic-app.backend'),
    }),
    new winston.transports.File({
      level: 'error',
      filename: path.join(logsDirectory, 'errors.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format: createLogFormat('application', 'comic-app.backend'),
    }),
  ],
});

export const accessLogger = createLogger('access', 'comic-app.http', 'access.log');
export const auditLogger = createLogger('audit', 'comic-app.audit', 'audit.log');
