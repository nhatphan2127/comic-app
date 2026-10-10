import { sequelize } from '../config/database.js';
import { TEXT, INTEGER, primaryId, ref, timestamp, withDefault, required } from './columns.js';

export const ReadHistory = sequelize.define('ReadHistory', {
  userId: ref('users', { primaryKey: true }),
  chapterId: ref('chapters', { primaryKey: true }),
  readAt: timestamp(),
  scrollPosition: withDefault(INTEGER, 0),
  currentPage: withDefault(INTEGER, 1),
}, { tableName: 'read_history' });

export const RatingHistory = sequelize.define('RatingHistory', {
  userId: ref('users', { primaryKey: true }),
  comicId: ref('comics', { primaryKey: true }),
  rating: required(INTEGER),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'rating_history' });

// Rows with userId = NULL are shared default categories; the rest belong to one user.
export const FollowingCategory = sequelize.define('FollowingCategory', {
  id: primaryId,
  category: required(TEXT),
  userId: ref('users', { allowNull: true }),
  createdAt: timestamp(),
}, { tableName: 'following_categories', indexes: [{ name: 'idx_following_categories_user', fields: ['userId'] }] });

export const Following = sequelize.define('Following', {
  id: primaryId,
  userId: ref('users'),
  comicId: ref('comics'),
  followingCategoryId: ref('following_categories', { allowNull: true }),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'following', indexes: [{ name: 'idx_following_category', fields: ['followingCategoryId'] }] });

// Views per comic per UTC day ('YYYY-MM-DD'): the rankings sum them over a period.
export const ComicDailyView = sequelize.define('ComicDailyView', {
  comicId: ref('comics', { primaryKey: true }),
  day: { type: TEXT, primaryKey: true },
  views: withDefault(INTEGER, 0),
}, { tableName: 'comic_daily_views', indexes: [{ name: 'idx_comic_daily_views_day', fields: ['day'] }] });

// Distinct chapters a user opened per UTC day (reading streaks and stats).
export const UserReadDay = sequelize.define('UserReadDay', {
  userId: ref('users', { primaryKey: true }),
  day: { type: TEXT, primaryKey: true },
  chapters: withDefault(INTEGER, 0),
}, { tableName: 'user_read_days' });
