// Follow / rating / reading history. No req/res here: inputs are plain values,
// failures are thrown as AppError subclasses and errorMiddleware maps them to HTTP statuses.
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as followRepo from '../repositories/followRepository.js';
import * as ratingRepo from '../repositories/ratingRepository.js';
import * as historyRepo from '../repositories/historyRepository.js';
import * as categoryRepo from '../repositories/categoryRepository.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// Following, rating and reading history are reader actions: they only work on comics and chapters readers
// can see (approved, public, not deleted), whatever the user's role. Once something is hidden it is out of
// reach entirely, so it cannot be unfollowed, unrated or removed from history either.
async function assertComicReadable(comicId) {
  if (!(await comicRepo.findReadable(comicId))) throw new NotFoundError('Comic not found');
}

export async function assertChapterReadable(chapterId) {
  if (!(await chapterRepo.findReadable(chapterId))) throw new NotFoundError('Chapter not found');
}

// GET /me/following/:comicId: the follow record, or 404 when the user does not follow the comic.
export async function getFollow(userId, comicId) {
  await assertComicReadable(comicId);
  const follow = await followRepo.find(userId, comicId);
  if (!follow) throw new NotFoundError('You are not following this comic');
  return { comicId: follow.comicId, categoryId: follow.categoryId, createdAt: follow.createdAt };
}

// PUT /me/following/:comicId: follow the comic, or move it to another category if already followed.
// Idempotent; `created` tells the controller whether to answer 201 or 200.
// Inserting the follow row and bumping comics.follow must succeed or fail together.
export async function followComic(userId, comicId, categoryId = null) {
  const created = await withTransaction(async () => {
    await assertComicReadable(comicId);

    if (categoryId && !(await categoryRepo.findOwnedOrDefault(categoryId, userId))) {
      throw new NotFoundError('Following category not found');
    }

    if (await followRepo.find(userId, comicId)) {
      await followRepo.updateCategory(userId, comicId, categoryId);
      return false;
    }
    await followRepo.insert({ userId, comicId, categoryId });
    await comicRepo.incrementFollowCount(comicId);
    return true;
  });
  return { created, follow: await getFollow(userId, comicId) };
}

// Idempotent: unfollowing a comic you don't follow is not an error (a comic readers can't see is a 404).
export async function unfollowComic(userId, comicId) {
  await withTransaction(async () => {
    await assertComicReadable(comicId);
    if (await followRepo.find(userId, comicId)) {
      await followRepo.remove(userId, comicId);
      await comicRepo.decrementFollowCount(comicId);
    }
  });
}

export async function rateComic(userId, comicId, rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError('"rating" must be an integer between 1 and 5');
  }

  return withTransaction(async () => {
    await assertComicReadable(comicId);
    await ratingRepo.upsert(userId, comicId, rating);
    const average = await ratingRepo.averageForComic(comicId);
    await comicRepo.setRating(comicId, average);
    return { comicId, userRating: rating, averageRating: Number(average.toFixed(1)) };
  });
}

// Taking a rating back is idempotent; the comic's average is recomputed without it.
export async function unrateComic(userId, comicId) {
  return withTransaction(async () => {
    await assertComicReadable(comicId);
    await ratingRepo.remove(userId, comicId);
    const average = Number(await ratingRepo.averageForComic(comicId));
    await comicRepo.setRating(comicId, average);
    return { comicId, userRating: 0, averageRating: Number(average.toFixed(1)) };
  });
}

export async function saveReadingHistory(userId, chapterId, currentPage) {
  if (!Number.isInteger(currentPage) || currentPage < 1) {
    throw new BadRequestError('"currentPage" must be a positive integer');
  }
  await assertChapterReadable(chapterId);
  await historyRepo.savePage(userId, chapterId, currentPage);
  return { chapterId, currentPage };
}
