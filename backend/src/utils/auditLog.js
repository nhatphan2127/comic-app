import { auditLogger } from '../config/logger.js';

export function recordAuditEvent(req, { action, category, outcome = 'success', resource, changes, status }) {
  const metadata = {
    event: { action, category, outcome },
    request: req?.requestId ? { id: req.requestId } : undefined,
    http: req
      ? {
          request: { method: req.method },
          ...(status ? { response: { status_code: status } } : {}),
        }
      : undefined,
    url: req?.path ? { path: req.path } : undefined,
    source: category === 'security' && req?.ip ? { ip: req.ip } : undefined,
    user: req?.user?.id ? { id: req.user.id } : undefined,
    resource,
    changes,
  };

  for (const key of Object.keys(metadata)) {
    if (metadata[key] === undefined) delete metadata[key];
  }

  auditLogger.info(action, metadata);
}
