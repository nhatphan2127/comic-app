// Every error response is an RFC 9457 "problem details" document:
//   Content-Type: application/problem+json
//   { "type": "about:blank", "title": "Not Found", "status": 404, "detail": "Comic not found", "instance": "/api/v1/comics/x" }
import { STATUS_CODES } from 'node:http';
import multer from 'multer';
import { NotFoundError } from '../errors.js';

// Multer error codes that mean "too big" rather than "malformed".
const MULTER_TOO_LARGE = ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_FIELD_VALUE', 'LIMIT_PART_COUNT'];

function statusOf(err) {
  if (err instanceof multer.MulterError) return MULTER_TOO_LARGE.includes(err.code) ? 413 : 400;
  // AppError sets `status`; body-parser sets it too (400 bad JSON, 413 too large, 415 bad charset).
  const status = err.status || err.statusCode;
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
}

export function sendProblem(res, req, status, detail) {
  if (status === 401) res.set('WWW-Authenticate', 'Bearer');
  res
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title: STATUS_CODES[status], status, detail, instance: req.originalUrl });
}

// Unknown URL (or a known URL with an unsupported method): a JSON 404 instead of Express's HTML page.
export function notFoundHandler(req, res, next) {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
}

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = statusOf(err);
  // 4xx are expected business errors; only unexpected failures are worth logging.
  if (status >= 500) console.error(err);
  // Never leak internal details (SQL errors, stack messages) to clients on server errors.
  const detail = status >= 500 ? 'Internal server error' : err.message || STATUS_CODES[status];
  sendProblem(res, req, status, detail);
}
