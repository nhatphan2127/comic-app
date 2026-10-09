// Readers ask to become contributors (/me/role-request); admins approve or reject (/admin/role-requests).
import * as roleRequestRepo from '../repositories/roleRequestRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import { withTransaction } from '../config/database.js';
import { sendTo } from './notificationService.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors.js';

export const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const DECISIONS = ['approved', 'rejected'];
const REASON_MIN = 20;
const REASON_MAX = 1000;
const PORTFOLIO_MAX = 1000;
const NOTE_MAX = 500;
// After a rejection the reader waits this long before asking again.
export const RETRY_AFTER_DAYS = 7;

const toRequest = (row) =>
  row && {
    id: row.id,
    requestedRole: row.requestedRole,
    reason: row.reason,
    portfolio: row.portfolio,
    status: row.status,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

// The latest request plus whether a new one may be sent now, so the profile can show the right state.
export async function getForUser(user) {
  const latest = await roleRequestRepo.findLatestForUser(user.id);
  let retryAfterDays = 0;
  if (latest?.status === 'rejected') {
    const days = await roleRequestRepo.daysSinceUpdate(latest.id);
    retryAfterDays = Math.max(0, Math.ceil(RETRY_AFTER_DAYS - days));
  }
  const canRequest = user.role === 'user' && latest?.status !== 'pending' && retryAfterDays === 0;
  return { request: toRequest(latest) ?? null, canRequest, retryAfterDays };
}

export async function create(user, { reason, portfolio }) {
  if (user.role !== 'user') throw new ForbiddenError('You already have contributor access');
  const cleanReason = clean(reason);
  if (cleanReason.length < REASON_MIN || cleanReason.length > REASON_MAX) {
    throw new BadRequestError(`"reason" must be between ${REASON_MIN} and ${REASON_MAX} characters`);
  }
  const cleanPortfolio = clean(portfolio) || null;
  if (cleanPortfolio && cleanPortfolio.length > PORTFOLIO_MAX) throw new BadRequestError(`"portfolio" must be at most ${PORTFOLIO_MAX} characters`);

  const state = await getForUser(user);
  if (state.request?.status === 'pending') throw new ConflictError('You already have a pending request');
  if (state.retryAfterDays > 0) throw new ConflictError(`You can send a new request in ${state.retryAfterDays} day(s)`);

  const row = await roleRequestRepo.insert({ userId: user.id, requestedRole: 'contributor', reason: cleanReason, portfolio: cleanPortfolio });
  return toRequest(await roleRequestRepo.findById(row.id));
}

export async function cancel(userId) {
  const pending = await roleRequestRepo.findPendingForUser(userId);
  if (!pending) throw new NotFoundError('No pending request');
  await roleRequestRepo.setStatus(pending.id, { status: 'cancelled' });
}

function toListItem(row) {
  return {
    ...toRequest(row),
    user: {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatar: row.avatar,
      role: row.userRole,
      createdAt: row.userCreatedAt,
    },
    reviewer: row.reviewerUsername ? { username: row.reviewerUsername, displayName: row.reviewerDisplayName } : null,
  };
}

export async function list({ statuses, page }) {
  const [rows, totalItems] = await Promise.all([
    roleRequestRepo.list({ statuses, limit: page.limit, offset: page.offset }),
    roleRequestRepo.count({ statuses }),
  ]);
  return { items: rows.map(toListItem), totalItems };
}

export async function decide(adminId, requestId, { status, note }) {
  if (!DECISIONS.includes(status)) throw new BadRequestError(`"status" must be one of: ${DECISIONS.join(', ')}`);
  const reviewNote = clean(note) || null;
  if (reviewNote && reviewNote.length > NOTE_MAX) throw new BadRequestError(`"note" must be at most ${NOTE_MAX} characters`);

  const request = await roleRequestRepo.findById(requestId);
  if (!request) throw new NotFoundError('Request not found');
  if (request.status !== 'pending') throw new ConflictError('This request has already been handled');

  const approved = status === 'approved';
  await withTransaction(async () => {
    await roleRequestRepo.setStatus(requestId, { status, reviewerId: adminId, reviewNote });
    // Never demote someone an admin promoted further in the meantime.
    const user = await userRepo.findById(request.userId);
    if (approved && user?.role === 'user') await userRepo.setRole(request.userId, request.requestedRole);
  });

  await sendTo(request.userId, {
    type: 'system_role_request',
    title: approved ? 'You are now a contributor' : 'Your contributor request was declined',
    content: approved
      ? [reviewNote, 'Open the Studio to upload chapters and suggest comics.'].filter(Boolean).join(' ')
      : reviewNote || `You can send a new request in ${RETRY_AFTER_DAYS} days.`,
    redirectPath: approved ? '/studio' : '/profile?tab=become-contributor',
  });

  return toRequest(await roleRequestRepo.findById(requestId));
}
