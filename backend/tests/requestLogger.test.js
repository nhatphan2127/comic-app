import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/logger.js', () => ({
  accessLogger: { info: vi.fn() },
  auditLogger: { info: vi.fn() },
}));

import { accessLogger, auditLogger } from '../src/config/logger.js';
import requestLoggerMiddleware from '../src/middlewares/requestLoggerMiddleware.js';
import { recordAuditEvent } from '../src/utils/auditLog.js';

describe('request and audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes HTTP metadata to the access logger without query strings or credentials', () => {
    const req = {
      method: 'GET',
      path: '/api/v1/comics/comic-123',
      baseUrl: '/api/v1',
      route: { path: '/comics/:comicId' },
      originalUrl: '/api/v1/comics/comic-123?secret=value',
      body: { password: 'not-for-logs' },
      headers: { authorization: 'Bearer not-for-logs' },
      ip: '127.0.0.1',
    };
    let finish;
    const res = {
      statusCode: 200,
      on: vi.fn((event, callback) => {
        if (event === 'finish') finish = callback;
      }),
    };
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(req.requestId).toBeTruthy();
    expect(next).toHaveBeenCalledOnce();
    expect(accessLogger.info).toHaveBeenCalledWith('HTTP request', expect.objectContaining({
      request: { id: req.requestId },
      http: {
        request: { method: 'GET' },
        response: { status_code: 200 },
        duration_ms: expect.any(Number),
      },
      url: { path: '/api/v1/comics/comic-123', route: '/api/v1/comics/:comicId' },
      source: { ip: '127.0.0.1' },
    }));
    expect(JSON.stringify(accessLogger.info.mock.calls)).not.toContain('not-for-logs');
    expect(JSON.stringify(accessLogger.info.mock.calls)).not.toContain('secret=value');
  });

  it('writes actor and outcome to audit logs without request bodies', () => {
    const req = {
      method: 'PATCH',
      path: '/api/v1/admin/users/user-2',
      requestId: 'request-1',
      ip: '127.0.0.1',
      user: { id: 'admin-1' },
      body: { password: 'not-for-logs' },
    };

    recordAuditEvent(req, {
      action: 'admin.user.updated',
      category: 'database',
      resource: { type: 'user', id: 'user-2' },
      changes: { role: 'moderator' },
    });

    expect(auditLogger.info).toHaveBeenCalledWith('admin.user.updated', expect.objectContaining({
      event: { action: 'admin.user.updated', category: 'database', outcome: 'success' },
      request: { id: 'request-1' },
      user: { id: 'admin-1' },
      resource: { type: 'user', id: 'user-2' },
      changes: { role: 'moderator' },
    }));
    expect(JSON.stringify(auditLogger.info.mock.calls)).not.toContain('not-for-logs');
  });
});
