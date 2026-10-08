import * as userRepo from '../repositories/userRepository.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import { listRecentForDashboard } from './commentService.js';
import { isAutoAcceptEnabled } from './settingsService.js';
import { BadRequestError, NotFoundError } from '../errors.js';

const VALID_ROLES = ['user', 'contributor', 'moderator', 'admin'];
const VISIBILITIES = ['public', 'hidden'];

export const REVIEW_STATUSES = ['pending', 'accept', 'reject'];
export { VISIBILITIES };

const CONTENT_TARGETS = {
  comic: { find: comicRepo.findById, set: comicRepo.setVisibility, list: comicRepo.listForStaff, notFound: 'Comic not found' },
  chapter: { find: chapterRepo.findById, set: chapterRepo.setVisibility, list: chapterRepo.listForStaff, notFound: 'Chapter not found' },
};

async function findOtherUser(adminId, userId, selfMessage) {
  if (userId === adminId) throw new BadRequestError(selfMessage);
  if (!(await userRepo.findById(userId))) throw new NotFoundError('User not found');
}

// PATCH /admin/users/:userId with { role?, isBanned? }. Validates everything before writing anything.
export async function updateUser(adminId, userId, { role, isBanned }) {
  if (role === undefined && isBanned === undefined) throw new BadRequestError('Nothing to update: send "role" and/or "isBanned"');
  if (role !== undefined && !VALID_ROLES.includes(role)) throw new BadRequestError(`"role" must be one of: ${VALID_ROLES.join(', ')}`);
  if (isBanned !== undefined && typeof isBanned !== 'boolean') throw new BadRequestError('"isBanned" must be a boolean');
  // An admin acting on their own account could lock themselves (and maybe everyone) out.
  await findOtherUser(adminId, userId, 'You cannot change your own role or ban yourself');

  if (role !== undefined) await userRepo.setRole(userId, role);
  if (isBanned !== undefined) await userRepo.setBanned(userId, isBanned);
  const user = await userRepo.findById(userId);
  return { id: user.id, username: user.username, role: user.role, isBanned: Boolean(user.isBanned) };
}

export async function setVisibility(type, targetId, visibility) {
  if (!VISIBILITIES.includes(visibility)) throw new BadRequestError(`"visibility" must be one of: ${VISIBILITIES.join(', ')}`);
  const t = CONTENT_TARGETS[type];
  if (!(await t.find(targetId))) throw new NotFoundError(t.notFound);
  await t.set(targetId, visibility);
  return { id: targetId, visibility };
}

// Every comic or chapter (hidden ones too), for admin and moderation tables. Returns { items, totalItems }.
export async function listContent(type, { statuses, visibilities, sort, page }) {
  const { rows, count } = await CONTENT_TARGETS[type].list({ statuses, visibilities, sort, limit: page.limit, offset: page.offset });
  return { items: rows, totalItems: count };
}

export async function getDashboard() {
  const [autoAccept, users, comments, comics, chapters] = await Promise.all([
    isAutoAcceptEnabled(),
    userRepo.listRecent(100),
    listRecentForDashboard(50),
    comicRepo.listByStatuses(['pending'], 10),
    chapterRepo.listByStatuses(['pending'], 10),
  ]);
  return { autoAccept, users, comments, comics, chapters };
}
