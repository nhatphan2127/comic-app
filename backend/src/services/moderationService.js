// Moderation queue and review decisions. Who may call these is decided by requireRole on the routes.
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { targetOf } from './contributorService.js';
import { settlePendingEdit } from './comicService.js';
import { notifyNewChapter, notifyReviewDecision } from './notificationService.js';
import { removeStoredFiles } from '../utils/storedFiles.js';
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
// For an approved comic with a parked edit, the decision is about the edit: accepting applies it,
// rejecting drops it, and the comic stays approved (and readable) in both cases, so its contributor rows
// go back to "accept" either way; the notification tells them what happened to their changes.
export async function review(type, targetId, status) {
  if (!['accept', 'reject'].includes(status)) throw new BadRequestError('"status" must be accept or reject');
  const t = targetOf(type);

  const { previous, edit, unusedFiles } = await withTransaction(async () => {
    if (type === 'comic') {
      const comic = await comicRepo.findById(targetId);
      if (!comic) throw new NotFoundError(t.notFound);
      if (comic.pendingChanges) {
        const files = await settlePendingEdit(targetId, status === 'accept');
        await contributorRepo.setStatusForTarget(type, targetId, 'accept');
        return { previous: 'pending', edit: true, unusedFiles: files };
      }
    }
    if (!(await t.find(targetId))) throw new NotFoundError(t.notFound);
    const before = type === 'comic' ? await comicRepo.findStatusById(targetId) : await chapterRepo.findStatusById(targetId);
    await t.setStatus(targetId, status);
    await contributorRepo.setStatusForTarget(type, targetId, status);
    return { previous: before, edit: false, unusedFiles: [] };
  });
  await removeStoredFiles(unusedFiles);

  // Only a real change is news; re-saving the same decision notifies nobody.
  if (previous !== status) {
    await notifyReviewDecision(type, targetId, status, { edit });
    if (type === 'chapter' && status === 'accept') await notifyNewChapter(targetId);
  }
  return { id: targetId, status };
}
