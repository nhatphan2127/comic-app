// Comic comments and chapter comments live in separate tables with the same shape,
// so both pairs of models are built by the same function.
import { sequelize } from '../config/database.js';
import { TEXT, INTEGER, primaryId, ref, timestamp, withDefault, required } from './columns.js';

// `shortName` keeps the index names of the original schema (idx_chapter_comments_chap_parent).
function defineComments(prefix, modelPrefix, fk, targetTable, shortName) {
  const table = `${prefix}_comments`;

  const Comment = sequelize.define(`${modelPrefix}Comment`, {
    id: primaryId,
    [fk]: ref(targetTable),
    userId: ref('users'),
    content: required(TEXT),
    parentCommentId: ref(table, { allowNull: true }),
    likes: withDefault(INTEGER, 0),
    dislikes: withDefault(INTEGER, 0),
    isBanned: withDefault(INTEGER, 0),
    deletedAt: TEXT,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }, {
    tableName: table,
    indexes: [
      { name: `idx_${table}_parent`, fields: ['parentCommentId'] },
      { name: `idx_${table}_${shortName}_parent`, fields: [fk, 'parentCommentId'] },
    ],
  });

  const Reaction = sequelize.define(`${modelPrefix}CommentReaction`, {
    userId: ref('users', { primaryKey: true }),
    commentId: ref(table, { primaryKey: true }),
    reactionType: required(TEXT), // like, dislike
    createdAt: timestamp(),
  }, { tableName: `${prefix}_comment_reactions` });

  return { Comment, Reaction };
}

export const { Comment: ComicComment, Reaction: ComicCommentReaction } = defineComments('comic', 'Comic', 'comicId', 'comics', 'comic');
export const { Comment: ChapterComment, Reaction: ChapterCommentReaction } = defineComments('chapter', 'Chapter', 'chapterId', 'chapters', 'chap');
