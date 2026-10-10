// Every model plus the relations used for joins. Importing this file also creates any missing
// tables (existing tables and their data are left as they are).
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User, UserPreference, PasswordReset, Session } from './user.js';
import { Author, Artist, Genre, Format, Comic, ComicGenre, ComicFormat, ComicOtherName, ComicContributor } from './comic.js';
import { Chapter, ChapterImage, ChapterContributor } from './chapter.js';
import { ReadHistory, RatingHistory, FollowingCategory, Following, ComicDailyView, UserReadDay } from './interaction.js';
import { ComicComment, ComicCommentReaction, ChapterComment, ChapterCommentReaction } from './comment.js';
import { Notification, AdminSetting, Report, RoleRequest, ApiKey, EditRequest, ModerationLog } from './system.js';

// Foreign keys are already declared on the columns (see ref() in columns.js), so the
// associations only describe joins and must not add constraints of their own.
const belongsTo = (model, target, as, foreignKey) => model.belongsTo(target, { as, foreignKey, constraints: false });

belongsTo(Session, User, 'user', 'userId');
belongsTo(Comic, Author, 'author', 'authorId');
belongsTo(Comic, Artist, 'artist', 'artistId');
belongsTo(ComicGenre, Genre, 'genre', 'genreId');
belongsTo(ComicFormat, Format, 'format', 'formatId');
belongsTo(ComicContributor, Comic, 'comic', 'comicId');
belongsTo(ComicContributor, User, 'user', 'userId');
belongsTo(Chapter, Comic, 'comic', 'comicId');
belongsTo(ChapterContributor, Chapter, 'chapter', 'chapterId');
belongsTo(ChapterContributor, User, 'user', 'userId');
belongsTo(RoleRequest, User, 'user', 'userId');
belongsTo(ApiKey, User, 'user', 'userId');

await sequelize.sync();

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

export {
  sequelize,
  User, UserPreference, PasswordReset, Session,
  Author, Artist, Genre, Format, Comic, ComicGenre, ComicFormat, ComicOtherName, ComicContributor,
  Chapter, ChapterImage, ChapterContributor,
  ReadHistory, RatingHistory, FollowingCategory, Following, ComicDailyView, UserReadDay,
  ComicComment, ComicCommentReaction, ChapterComment, ChapterCommentReaction,
  Notification, AdminSetting, Report, RoleRequest, ApiKey, EditRequest, ModerationLog,
};
