// Moderation queue and review decisions. Who may call these is decided by requireRole on the routes.
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { targetOf } from './contributorService.js';
import { notifyNewChapter, notifyReviewDecision } from './notificationService.js';
import { BadRequestError, NotFoundError } from '../errors.js';

const QUEUE_STATUSES = ['pending', 'accept', 'reject'];

// Empty list = every status.
export async function getQueue({ comicStatuses = [], chapterStatuses = [] }) {
  const [comics, chapters] = await Promise.all([
    comicRepo.listByStatuses(comicStatuses.length ? comicStatuses : QUEUE_STATUSES),
    chapterRepo.listByStatuses(chapterStatuses.length ? chapterStatuses : QUEUE_STATUSES),
  ]);
  return { comics, chapters };
}

// Accept/reject a comic or chapter together with all of its contributor rows.
export async function review(type, targetId, status) {
  if (!['accept', 'reject'].includes(status)) throw new BadRequestError('"status" must be accept or reject');
  const t = targetOf(type);
  const findStatus = type === 'comic' ? comicRepo.findStatusById : chapterRepo.findStatusById;

  const previous = await withTransaction(async () => {
    if (!(await t.find(targetId))) throw new NotFoundError(t.notFound);
    const before = await findStatus(targetId);
    await t.setStatus(targetId, status);
    await contributorRepo.setStatusForTarget(type, targetId, status);
    return before;
  });

  // Only a real change is news; re-saving the same decision notifies nobody.
  if (previous !== status) {
    await notifyReviewDecision(type, targetId, status);
    if (type === 'chapter' && status === 'accept') await notifyNewChapter(targetId);
  }
  return { id: targetId, status };
}
