// POST /reports (any logged-in user) and the moderators' report queue under /moderation/reports.
import asyncHandler from '../utils/asyncHandler.js';
import { created, ok } from '../utils/http.js';
import { pageMeta, parseEnumList, parsePagination } from '../utils/listQuery.js';
import * as reportService from '../services/reportService.js';
import { recordAuditEvent } from '../utils/auditLog.js';

// POST /reports { targetType: comic | comment, targetId, reason, details? }
export const createReport = asyncHandler(async (req, res) => {
  const report = await reportService.create(req.user.id, req.body || {});
  recordAuditEvent(req, {
    action: 'report.created',
    category: 'database',
    resource: { type: 'report', id: report.id },
  });
  created(res, `/moderation/reports/${report.id}`, report);
});

// GET /moderation/reports?status=open&page=&pageSize=
export const listReports = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query);
  const statuses = parseEnumList(req.query.status, 'status', reportService.STATUSES);
  const { items, totalItems } = await reportService.list({ statuses, page });
  ok(res, items, pageMeta(page, totalItems));
});

// PATCH /moderation/reports/:reportId { status: open | resolved | dismissed }
export const updateReport = asyncHandler(async (req, res) => {
  const report = await reportService.setStatus(req.user.id, req.params.reportId, req.body?.status);
  recordAuditEvent(req, {
    action: 'moderation.report.updated',
    category: 'database',
    resource: { type: 'report', id: req.params.reportId },
    changes: { status: req.body?.status },
  });
  ok(res, report);
});
