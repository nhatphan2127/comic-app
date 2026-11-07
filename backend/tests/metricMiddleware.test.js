import { beforeEach, describe, expect, it, vi } from 'vitest';

const metrics = vi.hoisted(() => ({
  httpRequestsTotal: { inc: vi.fn() },
  httpRequestDuration: { startTimer: vi.fn() },
  httpErrorsTotal: { inc: vi.fn() },
  httpActiveRequests: { inc: vi.fn(), dec: vi.fn() },
  httpRequestSize: { observe: vi.fn() },
  httpResponseSize: { observe: vi.fn() },
}));

vi.mock('../src/monitoring/metrics.js', () => metrics);

import { metricsMiddleware } from '../src/middlewares/metricMiddleware.js';

describe('metrics middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metrics.httpRequestDuration.startTimer.mockReturnValue(vi.fn());
  });

  it('uses the Express route template and completes request accounting once', () => {
    const req = {
      path: '/api/v1/comics/comic-123',
      method: 'GET',
      baseUrl: '/api/v1',
      route: { path: '/comics/:comicId' },
      headers: { 'content-length': '15' },
    };
    const listeners = {};
    const res = {
      statusCode: 200,
      writableFinished: true,
      once: vi.fn((event, callback) => {
        listeners[event] = callback;
      }),
      getHeader: vi.fn(() => '42'),
    };

    metricsMiddleware(req, res, vi.fn());
    listeners.finish();
    listeners.close();

    expect(metrics.httpRequestsTotal.inc).toHaveBeenCalledOnce();
    expect(metrics.httpRequestsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/comics/:comicId',
      status_code: '200',
    });
    expect(metrics.httpRequestDuration.startTimer.mock.results[0].value).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/comics/:comicId',
      status_code: '200',
    });
    expect(metrics.httpActiveRequests.inc).toHaveBeenCalledOnce();
    expect(metrics.httpActiveRequests.dec).toHaveBeenCalledOnce();
    expect(metrics.httpErrorsTotal.inc).not.toHaveBeenCalled();
  });

  it('accounts for disconnected requests and releases the active gauge', () => {
    const req = { path: '/api/v1/comics/123', method: 'GET', headers: {} };
    const listeners = {};
    const res = {
      statusCode: 200,
      writableFinished: false,
      once: vi.fn((event, callback) => {
        listeners[event] = callback;
      }),
      getHeader: vi.fn(),
    };

    metricsMiddleware(req, res, vi.fn());
    listeners.close();
    listeners.finish();

    expect(metrics.httpRequestsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: 'unmatched',
      status_code: '499',
    });
    expect(metrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: 'unmatched',
      status_code: '499',
    });
    expect(metrics.httpActiveRequests.dec).toHaveBeenCalledOnce();
  });

  it('does not count Prometheus scrapes as application requests', () => {
    const next = vi.fn();

    metricsMiddleware({ path: '/metrics' }, {}, next);

    expect(next).toHaveBeenCalledOnce();
    expect(metrics.httpActiveRequests.inc).not.toHaveBeenCalled();
    expect(metrics.httpRequestDuration.startTimer).not.toHaveBeenCalled();
  });
});
