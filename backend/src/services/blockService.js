// Blocking hides someone from me only: their comments (with the replies under them) leave my comment
// lists and their replies to me stop notifying me. Their profile stays reachable, everyone else sees
// everything as before, and the moderation tools ignore blocks.
import * as blockRepo from '../repositories/blockRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import { BadRequestError, NotFoundError } from '../errors.js';

async function assertBlockable(blockerId, blockedId) {
  if (blockerId === blockedId) throw new BadRequestError('You cannot block yourself');
  if (!(await userRepo.findById(blockedId))) throw new NotFoundError('User not found');
}

// Idempotent: blocking someone already blocked changes nothing.
export async function block(blockerId, blockedId) {
  await assertBlockable(blockerId, blockedId);
  await blockRepo.insertIfMissing(blockerId, blockedId);
}

export async function unblock(blockerId, blockedId) {
  await assertBlockable(blockerId, blockedId);
  await blockRepo.remove(blockerId, blockedId);
}

export async function list(blockerId, { page }) {
  const [items, totalItems] = await Promise.all([
    blockRepo.listForUser(blockerId, { limit: page.limit, offset: page.offset }),
    blockRepo.countForUser(blockerId),
  ]);
  return { items, totalItems };
}

export const isBlocked = (blockerId, blockedId) => blockRepo.exists(blockerId, blockedId);
