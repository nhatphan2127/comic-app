import { randomUUID } from 'node:crypto';
import { accessLogger } from '../config/logger.js';

export default function requestLoggerMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();

  const startedAt = Date.now();
  req.requestId = randomUUID();

  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    accessLogger.info('HTTP request', {
      request: { id: req.requestId },
      http: {
        request: { method: req.method },
        response: { status_code: res.statusCode },
        duration_ms: Date.now() - startedAt,
      },
      url: { path: req.path, route },
      source: { ip: req.ip },
    });
  });

  next();
}
