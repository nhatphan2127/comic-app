// Every model plus the relations used for joins. Importing this file creates missing tables and
// applies forward-only schema migrations for existing databases.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User, UserPreference, PasswordReset, Session, UserBlock } from './user.js';
import { Genre, Format, Comic, ComicGenre, ComicFormat, ComicOtherName, ComicContributor } from './comic.js';
import { Chapter, ChapterImage, ChapterContributor } from './chapter.js';
import { ReadHistory, RatingHistory, FollowingCategory, Following, ComicDailyView, UserReadDay } from './interaction.js';
import { ComicComment, ComicCommentReaction, ChapterComment, ChapterCommentReaction } from './comment.js';
import { Notification, AdminSetting, Report, RoleRequest, AdminImportBatch, EditRequest, ModerationLog } from './system.js';
import { installSearchText, dropSearchTriggers } from './searchText.js';

// Foreign keys are already declared on the columns (see ref() in columns.js), so the
// associations only describe joins and must not add constraints of their own.
const belongsTo = (model, target, as, foreignKey) => model.belongsTo(target, { as, foreignKey, constraints: false });

belongsTo(Session, User, 'user', 'userId');
belongsTo(ComicGenre, Genre, 'genre', 'genreId');
belongsTo(ComicFormat, Format, 'format', 'formatId');
belongsTo(ComicContributor, Comic, 'comic', 'comicId');
belongsTo(ComicContributor, User, 'user', 'userId');
belongsTo(Chapter, Comic, 'comic', 'comicId');
belongsTo(ChapterContributor, Chapter, 'chapter', 'chapterId');
belongsTo(ChapterContributor, User, 'user', 'userId');
belongsTo(RoleRequest, User, 'user', 'userId');
belongsTo(AdminImportBatch, User, 'admin', 'adminId');

await sequelize.sync();
await sequelize.query('DROP TABLE IF EXISTS api_keys');

// sync() creates missing tables but never changes existing ones, so columns added later are added here.
async function addColumnIfMissing(table, column, definition, afterAdd) {
  const columns = await sequelize.query(`PRAGMA table_info(${table})`, { type: QueryTypes.SELECT });
  if (columns.some((c) => c.name === column)) return;
  await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  if (afterAdd) await afterAdd();
}

// Preferences were never written by the frontend before `reader` existed, so the stored 'light'
// themes are registration defaults, not choices: reset them to the app's default theme.
await addColumnIfMissing('user_preferences', 'reader', 'TEXT', () =>
  sequelize.query("UPDATE user_preferences SET theme = 'main'"));

await addColumnIfMissing('comics', 'pendingChanges', 'TEXT');

async function tableExists(table) {
  const rows = await sequelize.query(
    'SELECT 1 FROM sqlite_master WHERE type = :type AND name = :name',
    { replacements: { type: 'table', name: table }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function migrateComicCredits() {
  const columns = await sequelize.query('PRAGMA table_info(comics)', { type: QueryTypes.SELECT });
  const columnNames = new Set(columns.map((column) => column.name));
  const hasAuthors = await tableExists('author');
  const hasArtists = await tableExists('artist');

  if (!columnNames.has('author')) await sequelize.query('ALTER TABLE comics ADD COLUMN author TEXT');
  if (!columnNames.has('artist')) await sequelize.query('ALTER TABLE comics ADD COLUMN artist TEXT');

  await dropSearchTriggers();

  if (hasAuthors && columnNames.has('authorId')) {
    await sequelize.query(
      'UPDATE comics SET author = (SELECT name FROM author WHERE author.id = comics.authorId) WHERE author IS NULL'
    );
  }
  if (hasArtists && columnNames.has('artistId')) {
    await sequelize.query(
      'UPDATE comics SET artist = (SELECT name FROM artist WHERE artist.id = comics.artistId) WHERE artist IS NULL'
    );
  }

  if (columnNames.has('authorId')) await sequelize.query('ALTER TABLE comics DROP COLUMN authorId');
  if (columnNames.has('artistId')) await sequelize.query('ALTER TABLE comics DROP COLUMN artistId');
  if (columnNames.has('demographic')) await sequelize.query('ALTER TABLE comics DROP COLUMN demographic');
  if (hasAuthors) await sequelize.query('DROP TABLE author');
  if (hasArtists) await sequelize.query('DROP TABLE artist');
}

await migrateComicCredits();

// Folded copy of the searchable fields, kept up to date by triggers (see searchText.js).
await addColumnIfMissing('comics', 'searchText', 'TEXT');
await installSearchText();

export {
  sequelize,
  User, UserPreference, PasswordReset, Session, UserBlock,
  Genre, Format, Comic, ComicGenre, ComicFormat, ComicOtherName, ComicContributor,
  Chapter, ChapterImage, ChapterContributor,
  ReadHistory, RatingHistory, FollowingCategory, Following, ComicDailyView, UserReadDay,
  ComicComment, ComicCommentReaction, ChapterComment, ChapterCommentReaction,
  Notification, AdminSetting, Report, RoleRequest, AdminImportBatch, EditRequest, ModerationLog,
};
