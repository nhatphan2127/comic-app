
import * as client from '@prometheus-io/client';

// Collect Node.js runtime metrics
client.collectDefaultMetrics();

// 1. Total HTTP requests
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// 2. HTTP request duration
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// 3. HTTP errors
export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses',
  labelNames: ['method', 'route', 'status_code'],
});

// 4. Active requests
export const httpActiveRequests = new client.Gauge({
  name: 'http_active_requests',
  help: 'Number of HTTP requests currently processing',
});

// 5. Request size
export const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Incoming HTTP request size in bytes',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
});

// 6. Response size
export const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response size in bytes',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
});
