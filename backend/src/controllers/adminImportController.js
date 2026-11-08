import asyncHandler from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import { recordAuditEvent } from '../utils/auditLog.js';
import * as adminImportService from '../services/adminImportService.js';

export const begin = asyncHandler(async (req, res) => {
  const result = await adminImportService.createImport(req.user, req.body);
  created(res, `/admin/imports/${result.id}`, result);
});

export const status = asyncHandler(async (req, res) => {
  ok(res, await adminImportService.getImportStatus(req.user, req.params.importId));
});

export const stageItem = asyncHandler(async (req, res) => {
  ok(res, await adminImportService.stageImportFile(
    req.user,
    req.params.importId,
    req.params.fileId,
    req.file,
  ));
});

export const commit = asyncHandler(async (req, res) => {
  const result = await adminImportService.commitImport(req.user, req.params.importId, {
    autoApprove: req.body?.autoApprove,
  });
  recordAuditEvent(req, {
    action: 'admin.zip_import.completed',
    category: 'database',
    resource: { type: 'admin_import', id: req.params.importId },
    changes: result.summary,
  });
  ok(res, result);
});

export const abort = asyncHandler(async (req, res) => {
  await adminImportService.abortImport(req.user, req.params.importId);
  noContent(res);
});
