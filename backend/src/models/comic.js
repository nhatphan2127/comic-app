import { sequelize } from '../config/database.js';
import { TEXT, INTEGER, REAL, primaryId, ref, timestamp, withDefault, required } from './columns.js';

// Name-only lookup tables.
const lookupColumns = (nameIsUnique) => ({
  id: primaryId,
  name: { type: TEXT, allowNull: false, unique: nameIsUnique },
});

export const Author = sequelize.define('Author', { ...lookupColumns(false), bio: TEXT }, { tableName: 'author' });
export const Artist = sequelize.define('Artist', { ...lookupColumns(false), bio: TEXT }, { tableName: 'artist' });
export const Genre = sequelize.define('Genre', { ...lookupColumns(true), description: TEXT }, { tableName: 'genres' });
export const Format = sequelize.define('Format', { ...lookupColumns(true), description: TEXT }, { tableName: 'formats' });

export const Comic = sequelize.define('Comic', {
  id: primaryId,
  name: required(TEXT),
  source: TEXT,
  types: required(TEXT), // manga, manhwa, manhua, other
  status: withDefault(TEXT, 'pending'), // pending, accept, reject (moderation)
  // An edit of an approved comic waiting for review (JSON); readers keep seeing the approved version.
  pendingChanges: TEXT,
  contentRating: required(TEXT), // safe, suggestive, erotica, pornographic
  demographic: required(TEXT), // josei, seinen, shoujo, shounen
  description: TEXT,
  rating: withDefault(REAL, 0),
  coverUrl: TEXT,
  view: withDefault(INTEGER, 0),
  follow: withDefault(INTEGER, 0),
  releaseStatus: required(TEXT), // releasing, finished, on hiatus, discontinued
  visibility: withDefault(TEXT, 'public'), // public, hidden
  deletedAt: TEXT, // soft delete
  url: { type: TEXT, allowNull: false, unique: true },
  releasingYear: INTEGER,
  authorId: ref('author', { allowNull: true }),
  artistId: ref('artist', { allowNull: true }),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'comics' });

export const ComicGenre = sequelize.define('ComicGenre', {
  comicId: ref('comics', { primaryKey: true }),
  genreId: ref('genres', { primaryKey: true }),
}, { tableName: 'comic_genres', indexes: [{ name: 'idx_comic_genres_comic', fields: ['comicId'] }] });

export const ComicFormat = sequelize.define('ComicFormat', {
  comicId: ref('comics', { primaryKey: true }),
  formatId: ref('formats', { primaryKey: true }),
}, { tableName: 'comic_formats', indexes: [{ name: 'idx_comic_formats_comic', fields: ['comicId'] }] });

export const ComicOtherName = sequelize.define('ComicOtherName', {
  id: primaryId,
  comicId: ref('comics'),
  name: required(TEXT),
  country: required(TEXT),
}, { tableName: 'comic_other_names' });

export const ComicContributor = sequelize.define('ComicContributor', {
  comicId: ref('comics', { primaryKey: true }),
  userId: ref('users', { primaryKey: true }),
  role: withDefault(TEXT, 'uploader'),
  status: withDefault(TEXT, 'pending'), // pending, accept, reject
  unread: withDefault(INTEGER, 1),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'comic_contributors' });
