import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database.js';
import * as userRepo from '../repositories/userRepository.js';
import * as sessionRepo from '../repositories/sessionRepository.js';
import * as preferenceRepo from '../repositories/preferenceRepository.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as followRepo from '../repositories/followRepository.js';
import * as historyRepo from '../repositories/historyRepository.js';
import * as categoryRepo from '../repositories/categoryRepository.js';
import { assertValidPassword, hashPassword, verifyPassword } from './authService.js';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../errors.js';

const DEFAULT_PREFERENCE = { theme: 'main', filter: 1, reader: null };
const THEMES = ['main', 'dark', 'light'];
const FILTER_LEVELS = 4; // safe, suggestive, erotica, pornographic
const READER_MAX_BYTES = 2000;

async function findUserOrThrow(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

// ---------- Profile ----------

// Someone else's profile (GET /users/:userId): public fields and counters, never email or settings.
export async function getPublicProfile(userId) {
  const user = await userRepo.findPublicById(userId);
  if (!user) throw new NotFoundError('User not found');
  const { following, comments, likes } = await userRepo.stats(userId);
  return { ...user, stats: { following, comments, likes } };
}

export async function getProfile(userId) {
  const user = await findUserOrThrow(userId);
  const [preference, stats] = await Promise.all([preferenceRepo.find(userId), userRepo.stats(userId)]);
  user.preference = preference || DEFAULT_PREFERENCE;
  user.stats = stats;
  return user;
}

export async function updateProfile(userId, fields) {
  const user = await findUserOrThrow(userId);

  if (fields.username !== undefined && fields.username !== user.username) {
    if (await userRepo.findIdByUsername(fields.username)) throw new ConflictError('Username already exists');
  }

  await userRepo.updateProfile(userId, fields);
  return userRepo.findById(userId);
}

// `kind` is 'avatar' or 'background'; the stored path is relative to /storage.
export async function setProfileImage(userId, kind, filename) {
  if (!filename) throw new BadRequestError(`${kind === 'avatar' ? 'Avatar' : 'Background'} file is required`);
  const folder = kind === 'avatar' ? 'avatars' : 'backgrounds';
  await userRepo.updateProfile(userId, { [kind]: `${folder}/${filename}` });
  return userRepo.findById(userId);
}

export async function changePassword(userId, currentSessionToken, { currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new BadRequestError('Current password, new password and confirmation are required');
  }
  if (newPassword !== confirmPassword) throw new BadRequestError('New passwords do not match');
  assertValidPassword(newPassword);

  const user = await userRepo.findPasswordById(userId);
  if (!user) throw new NotFoundError('User not found');
  if (!(await verifyPassword(user, currentPassword))) throw new UnauthorizedError('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  // Changing the password logs out every other device.
  await withTransaction(async () => {
    await userRepo.updatePassword(userId, passwordHash);
    await sessionRepo.removeOthers(userId, currentSessionToken);
  });
}

// Only the fields that are sent change. `reader` is an opaque object owned by the frontend's reader.
export async function updatePreferences(userId, { theme, filter, reader }) {
  if (theme !== undefined && !THEMES.includes(theme)) throw new BadRequestError(`"theme" must be one of: ${THEMES.join(', ')}`);
  if (filter !== undefined && !(Number.isInteger(filter) && filter >= 0 && filter < FILTER_LEVELS)) {
    throw new BadRequestError(`"filter" must be an integer from 0 to ${FILTER_LEVELS - 1}`);
  }
  if (reader !== undefined) {
    if (reader === null || typeof reader !== 'object' || Array.isArray(reader)) throw new BadRequestError('"reader" must be an object');
    if (JSON.stringify(reader).length > READER_MAX_BYTES) throw new BadRequestError('"reader" is too large');
  }
  await preferenceRepo.upsert(userId, { theme, filter, reader });
  return preferenceRepo.find(userId);
}

// ---------- Following list ----------

function groupByComic(rows, comicIds, mapRow) {
  const map = Object.fromEntries(comicIds.map((id) => [id, []]));
  rows.forEach((row) => map[row.comicId].push(mapRow(row)));
  return map;
}

export async function getFollowingList(userId) {
  const list = await followRepo.listForUser(userId);
  if (list.length === 0) return [];

  const comicIds = list.map((item) => item.comicId);
  const [otherNames, genres, formats] = await Promise.all([
    comicRepo.listOtherNamesForComics(comicIds),
    comicRepo.listGenresForComics(comicIds),
    comicRepo.listFormatsForComics(comicIds),
  ]);
  const namesMap = groupByComic(otherNames, comicIds, (row) => ({ name: row.name, country: 'Unknown' }));
  const genresMap = groupByComic(genres, comicIds, (row) => row.name);
  const formatsMap = groupByComic(formats, comicIds, (row) => row.name);

  // Shape matches the frontend FollowingComic interface.
  return list.map((item) => ({
    userId: item.userId,
    updatedAt: item.followingUpdatedAt,
    comic: {
      id: item.comicId,
      name: item.comicName || undefined,
      names: namesMap[item.comicId],
      url: item.comicUrl,
      coverUrl: item.comicCoverUrl,
      description: item.comicDescription || undefined,
      updatedAt: item.comicUpdatedAt || null,
      types: item.comicTypes || undefined,
      contentRating: item.comicContentRating || undefined,
      demographic: item.comicDemographic || undefined,
      genres: genresMap[item.comicId],
      tags: [],
      formats: formatsMap[item.comicId],
      releaseStatus: item.comicReleaseStatus || undefined,
      releasingYear: item.comicReleasingYear ? String(item.comicReleasingYear) : undefined,
      userRating: item.userRating || undefined,
      rating: item.comicRating || 0,
      view: item.comicView || 0,
      follow: item.comicFollow || 0,
      author: item.authorName || undefined,
      artist: item.artistName || undefined,
      latestChapters: [],
    },
    category: {
      id: item.categoryId || '',
      category: item.categoryName || 'Default',
    },
    readedChapter: item.readedChapter !== null ? item.readedChapter : 0,
    totalChapters: item.totalChapters || 0,
    unreadChapters: item.unreadChapters || 0,
    latestChapterAt: item.latestChapterAt || null,
    lastReadAt: item.lastReadAt || null,
    followedAt: item.followedAt || null,
  }));
}

// ---------- Following categories ----------

export const getFollowingCategories = (userId) => categoryRepo.listVisibleTo(userId);

function requireCategoryName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new BadRequestError('Category name is required');
  return trimmed;
}

export async function createFollowingCategory(userId, name) {
  const trimmed = requireCategoryName(name);
  if (await categoryRepo.findByNameVisibleTo(trimmed, userId)) throw new ConflictError('Category already exists');

  const id = uuidv4();
  await categoryRepo.insert({ id, name: trimmed, userId });
  return { id, category: trimmed, userId };
}

// Shared default categories (userId IS NULL) are read-only, so only owned rows are found here.
export async function renameFollowingCategory(userId, categoryId, name) {
  const trimmed = requireCategoryName(name);
  if (!(await categoryRepo.findOwned(categoryId, userId))) throw new NotFoundError('Category not found');
  await categoryRepo.rename(categoryId, userId, trimmed);
  return { id: categoryId, category: trimmed };
}

export async function deleteFollowingCategory(userId, categoryId) {
  await withTransaction(async () => {
    if (!(await categoryRepo.findOwned(categoryId, userId))) throw new NotFoundError('Category not found');
    await followRepo.clearCategory(userId, categoryId);
    await categoryRepo.remove(categoryId, userId);
  });
}

// ---------- History ----------

// Paginated lists return { items, totalItems }; `page` comes from parsePagination.
export async function getReadingHistory(userId, { page }) {
  const [items, totalItems] = await Promise.all([
    historyRepo.listForUser(userId, { limit: page.limit, offset: page.offset }),
    historyRepo.countForUser(userId),
  ]);
  return { items, totalItems };
}

export const removeHistoryChapter = (userId, chapterId) => historyRepo.remove(userId, chapterId);

export const clearReadingHistory = (userId) => historyRepo.clear(userId);
