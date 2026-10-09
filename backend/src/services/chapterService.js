import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as historyRepo from '../repositories/historyRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { initialReviewStatus } from './settingsService.js';
import { notifyNewChapter } from './notificationService.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';

// `comicKey` is the comic's id or url slug. Returns one page: { items, totalItems }.
export async function listPublicByComic(comicKey, { sort, page }) {
  const comic = await comicRepo.findPublicIdByKey(comicKey);
  if (!comic) throw new NotFoundError('Comic not found');
  const { rows, count } = await chapterRepo.listPublicByComic(comic.id, { sort, limit: page.limit, offset: page.offset });
  return { items: rows, totalItems: count };
}

// Opening a chapter as a logged-in reader also records it in their reading history. Readers of any role
// only open approved, public chapters; staff preview the rest through getForReview.
export async function openForReading(chapterId, viewer = null) {
  const chapter = await chapterRepo.findReadable(chapterId);
  if (!chapter) throw new NotFoundError('Chapter not found');

  const images = await chapterRepo.listImages(chapter.id);
  let metadata = {};
  if (viewer) {
    await historyRepo.touch(viewer.id, chapter.id);
    metadata = (await historyRepo.findCurrentPage(viewer.id, chapter.id)) || {};
  }
  metadata.totalPages = images.length;

  return { id: chapter.id, chapterNumber: chapter.chapterNumber, title: chapter.title, images, metadata };
}

// Moderation preview: any chapter with its pages, without touching anyone's reading history.
export async function getForReview(chapterId) {
  const chapter = await chapterRepo.findForReview(chapterId);
  if (!chapter) throw new NotFoundError('Chapter not found');
  const images = await chapterRepo.listImages(chapter.id);
  return { ...chapter, images, metadata: { totalPages: images.length } };
}

// Any contributor may upload chapters to any comic (by design); chapters still go through moderation.
export async function create(user, comicId, { title, chapterNumber, url }, imageFilenames = []) {
  if (!title || chapterNumber === undefined || chapterNumber === '' || !url || !imageFilenames.length) {
    throw new BadRequestError('Missing required chapter fields or images');
  }
  const number = Number(chapterNumber);
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestError('Chapter number must be a non-negative number');
  }

  const chapterId = uuidv4();
  const status = await withTransaction(async () => {
    if (!(await comicRepo.findActiveById(comicId))) throw new NotFoundError('Comic not found');
    if (await chapterRepo.findIdByUrl(url)) throw new ConflictError('Chapter URL already exists');

    const initialStatus = await initialReviewStatus();
    await chapterRepo.insert({ id: chapterId, comicId, title, chapterNumber: number, url, status: initialStatus });

    await chapterRepo.insertImages(
      imageFilenames.map((filename, index) => ({ id: uuidv4(), chapterId, urlPath: `chapter-images/${filename}`, pageNumber: index + 1 }))
    );

    await contributorRepo.insertIgnore('chapter', { targetId: chapterId, userId: user.id, status: initialStatus });
    return initialStatus;
  });

  // With auto-accept on, the chapter is live right away.
  if (status === 'accept') await notifyNewChapter(chapterId, user.id);
  return { chapterId, chapterNumber: number, title, imagesCount: imageFilenames.length, status };
}
