import { sequelize } from '../config/database.js';
import { TEXT, INTEGER, REAL, primaryId, ref, timestamp, withDefault, required } from './columns.js';

export const Chapter = sequelize.define('Chapter', {
  id: primaryId,
  comicId: ref('comics'),
  title: required(TEXT),
  chapterNumber: required(REAL),
  status: withDefault(TEXT, 'pending'),
  visibility: withDefault(TEXT, 'public'),
  deletedAt: TEXT,
  url: { type: TEXT, allowNull: false, unique: true },
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'chapters' });

export const ChapterImage = sequelize.define('ChapterImage', {
  id: primaryId,
  chapterId: ref('chapters'),
  urlPath: required(TEXT),
  pageNumber: required(INTEGER),
}, { tableName: 'chapter_images' });

export const ChapterContributor = sequelize.define('ChapterContributor', {
  chapterId: ref('chapters', { primaryKey: true }),
  userId: ref('users', { primaryKey: true }),
  role: withDefault(TEXT, 'contributor'),
  status: withDefault(TEXT, 'pending'),
  unread: withDefault(INTEGER, 1),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'chapter_contributors' });
