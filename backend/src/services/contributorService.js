// Contributor records for comics and chapters. `type` is 'comic' or 'chapter'.
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { BadRequestError, NotFoundError } from '../errors.js';

export const REVIEW_STATUSES = ['accept', 'reject'];

// Per type: how to find the target, how to describe it in responses, how to change its status.
export const TARGETS = {
  comic: {
    find: async (id) => {
      const comic = await comicRepo.findSummaryById(id);
      return comic && { id: comic.id, name: comic.name };
    },
    setStatus: comicRepo.setStatus,
    notFound: 'Comic not found',
    idKey: 'comicId',
  },
  chapter: {
    find: async (id) => {
      const chapter = await chapterRepo.findById(id);
      return chapter && { id: chapter.id, title: chapter.title, comicId: chapter.comicId };
    },
    setStatus: chapterRepo.setStatus,
    notFound: 'Chapter not found',
    idKey: 'chapterId',
  },
};

export function targetOf(type) {
  const t = TARGETS[type];
  if (!t) throw new BadRequestError('Unsupported target type');
  return t;
}

export async function listForTarget(type, targetId) {
  const t = targetOf(type);
  const target = await t.find(targetId);
  if (!target) throw new NotFoundError(t.notFound);

  const rows = await contributorRepo.listForTarget(type, targetId);
  const contributors = rows.map((row) => ({
    [t.idKey]: row.targetId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    unread: row.unread,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: { id: row.userId, displayName: row.displayName, avatar: row.avatar },
  }));
  return { [type]: target, contributors };
}

// Accepting/rejecting one contributor also sets the target's own status, atomically.
export async function updateStatus(type, targetId, userId, status) {
  if (!REVIEW_STATUSES.includes(status)) throw new BadRequestError('Invalid status. Must be accept or reject.');
  const t = targetOf(type);

  await withTransaction(async () => {
    if (!(await contributorRepo.isContributor(type, targetId, userId))) throw new NotFoundError('Contributor not found');
    await contributorRepo.setStatusForUser(type, targetId, userId, status);
    await t.setStatus(targetId, status);
  });

  return { [t.idKey]: targetId, userId, status, updatedAt: new Date().toISOString() };
}

export async function listMyComicContributions(userId) {
  const rows = await contributorRepo.listComicContributionsOfUser(userId);
  return rows.map((row) => ({
    comicId: row.comicId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    unread: row.unread,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // The comic is live and an edit of it is waiting for review.
    pendingEdit: Boolean(row.pendingEdit),
    comic: { id: row.id, name: row.name, coverUrl: row.coverUrl, url: row.url, types: row.types, demographic: row.demographic },
  }));
}

export async function listMyChapterContributions(userId) {
  const rows = await contributorRepo.listChapterContributionsOfUser(userId);
  return rows.map((row) => ({
    chapterId: row.chapterId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    unread: row.unread,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    chapter: { id: row.id, chapterNumber: row.chapterNumber, title: row.title, url: row.url, comicId: row.comicId },
    comic: { name: row.comicName, coverUrl: row.comicCoverUrl },
  }));
}
