import * as reportRepo from '../repositories/reportRepository.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as commentRepo from '../repositories/commentRepository.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';

export const TARGET_TYPES = ['comic', 'comment'];
export const STATUSES = ['open', 'resolved', 'dismissed'];
const REASON_MAX = 100;
const DETAILS_MAX = 1000;

async function targetExists(targetType, targetId) {
  if (targetType === 'comic') return Boolean(await comicRepo.findActiveById(targetId));
  for (const type of commentRepo.COMMENT_TYPES) {
    if (await commentRepo.findById(type, targetId)) return true;
  }
  return false;
}

export async function create(userId, { targetType, targetId, reason, details }) {
  if (!TARGET_TYPES.includes(targetType)) throw new BadRequestError(`"targetType" must be one of: ${TARGET_TYPES.join(', ')}`);
  if (typeof targetId !== 'string' || !targetId) throw new BadRequestError('"targetId" is required');
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (!cleanReason || cleanReason.length > REASON_MAX) throw new BadRequestError(`"reason" is required (max ${REASON_MAX} characters)`);
  const cleanDetails = (typeof details === 'string' ? details.trim() : '') || null;
  if (cleanDetails && cleanDetails.length > DETAILS_MAX) throw new BadRequestError(`"details" must be at most ${DETAILS_MAX} characters`);

  if (!(await targetExists(targetType, targetId))) throw new NotFoundError(targetType === 'comic' ? 'Comic not found' : 'Comment not found');
  // One open report per reader and target, so repeated clicks don't flood the queue.
  if (await reportRepo.findOpen(userId, targetType, targetId)) throw new ConflictError('You have already reported this');

  const report = await reportRepo.insert({ userId, targetType, targetId, reason: cleanReason, details: cleanDetails });
  return { id: report.id, targetType, targetId, reason: cleanReason, details: cleanDetails, status: 'open' };
}

// Flat SQL row → { ..., reporter, target } with a path the frontend can link to.
function toItem(row) {
  const target = { type: row.targetType, id: row.targetId, title: null, content: null, path: null };
  if (row.targetType === 'comic') {
    target.title = row.comicName;
    target.path = row.comicUrl ? `/comics/${row.comicUrl}` : null;
  } else {
    target.title = row.commentComicName;
    target.content = row.commentContent;
    if (row.commentComicUrl) {
      const base = row.commentSource === 'chapter' ? `/comics/${row.commentComicUrl}/${row.commentChapterId}` : `/comics/${row.commentComicUrl}`;
      target.path = `${base}?cm_id=${row.targetId}`;
    }
  }
  return {
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reporter: { username: row.reporterUsername, displayName: row.reporterDisplayName },
    target,
  };
}

export async function list({ statuses, page }) {
  const [rows, totalItems] = await Promise.all([
    reportRepo.list({ statuses, limit: page.limit, offset: page.offset }),
    reportRepo.count({ statuses }),
  ]);
  return { items: rows.map(toItem), totalItems };
}

export async function setStatus(moderatorId, reportId, status) {
  if (!STATUSES.includes(status)) throw new BadRequestError(`"status" must be one of: ${STATUSES.join(', ')}`);
  if (!(await reportRepo.findById(reportId))) throw new NotFoundError('Report not found');
  await reportRepo.setStatus(reportId, status, status === 'open' ? null : moderatorId);
  return { id: reportId, status };
}
