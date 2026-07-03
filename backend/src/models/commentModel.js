import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { buildCommentTree } from '../helpers/helpers.js';

// Comic Comment operations
export const createComicComment = async (comicId, userId, content, parentCommentId = null) => {
  const id = uuidv4();
  await db.run(
    `INSERT INTO comic_comments (id, comicId, userId, content, parentCommentId, createdAt, updatedAt, likes, dislikes)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0)`,
    [id, comicId, userId, content, parentCommentId]
  );
  return getComicComment(id);
};

export const getComicComment = async (commentId) => {
  const comment = await db.get(
    `SELECT cc.*, u.displayName, u.avatar
     FROM comic_comments cc
     LEFT JOIN users u ON cc.userId = u.id
     WHERE cc.id = ?`,
    [commentId]
  );
  return comment;
};

export const getComicComments = async (comicId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  // Sử dụng RECURSIVE CTE để lấy 20 comment root cùng toàn bộ con cháu của chúng
  const rawComments = await db.all(
    `WITH RECURSIVE
      root_comments AS (
        -- Lấy 20 bình luận gốc được phân trang
        SELECT cc.id, cc.comicId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar
        FROM comic_comments cc
        LEFT JOIN users u ON cc.userId = u.id
        WHERE cc.comicId = ? AND cc.parentCommentId IS NULL
        ORDER BY cc.createdAt DESC
        LIMIT ? OFFSET ?
      ),
      comment_tree AS (
        -- Phần Neo (Anchor): Bắt đầu từ các bình luận gốc đã lọc ở trên
        SELECT id, comicId, NULL AS chapterId, userId, content, parentCommentId, createdAt, updatedAt, likes, dislikes, displayName, avatar
        FROM root_comments

        UNION ALL

        -- Phần Đệ quy: Tìm các bình luận con có parentCommentId khớp với id trong comment_tree
        SELECT cc.id, cc.comicId, NULL AS chapterId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar
        FROM comic_comments cc
        LEFT JOIN users u ON cc.userId = u.id
        INNER JOIN comment_tree ct ON cc.parentCommentId = ct.id
      )
    SELECT * FROM comment_tree`,
    [comicId, limit, offset]
  );

  // Tính tổng số lượng bình luận gốc để phục vụ phân trang
  const total = await db.get(
    'SELECT COUNT(*) as count FROM comic_comments WHERE comicId = ? AND parentCommentId IS NULL',
    [comicId]
  );

  // Dựng lại cây thư mục comment từ kết quả phẳng
  const commentsTree = buildCommentTree(rawComments);

  return { 
    comments: commentsTree, 
    total: total?.count || 0, 
    page, 
    limit 
  };
};

export const updateComicComment = async (commentId, content) => {
  await db.run(
    'UPDATE comic_comments SET content = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [content, commentId]
  );
  return getComicComment(commentId);
};

export const deleteComicComment = async (commentId) => {
  // Delete all reactions first
  await db.run('DELETE FROM comic_comment_reactions WHERE commentId = ?', [commentId]);
  // Delete all nested comments
  const replies = await db.all('SELECT id FROM comic_comments WHERE parentCommentId = ?', [commentId]);
  for (let reply of replies) {
    await deleteComicComment(reply.id);
  }
  // Delete the comment itself
  await db.run('DELETE FROM comic_comments WHERE id = ?', [commentId]);
};

// Chapter Comment operations
export const createChapterComment = async (chapterId, userId, content, parentCommentId = null) => {
  const id = uuidv4();
  await db.run(
    `INSERT INTO chapter_comments (id, chapterId, userId, content, parentCommentId, createdAt, updatedAt, likes, dislikes)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0)`,
    [id, chapterId, userId, content, parentCommentId]
  );
  return getChapterComment(id);
};

export const getChapterComment = async (commentId) => {
  const comment = await db.get(
    `SELECT cc.*, u.displayName, u.avatar
     FROM chapter_comments cc
     LEFT JOIN users u ON cc.userId = u.id
     WHERE cc.id = ?`,
    [commentId]
  );
  return comment;
};

export const getChapterComments = async (chapterId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  // Tương tự với chapter_comments
  const rawComments = await db.all(
    `WITH RECURSIVE
      root_comments AS (
        SELECT cc.id, cc.chapterId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar
        FROM chapter_comments cc
        LEFT JOIN users u ON cc.userId = u.id
        WHERE cc.chapterId = ? AND cc.parentCommentId IS NULL
        ORDER BY cc.createdAt DESC
        LIMIT ? OFFSET ?
      ),
      comment_tree AS (
        SELECT id, NULL AS comicId, chapterId, userId, content, parentCommentId, createdAt, updatedAt, likes, dislikes, displayName, avatar
        FROM root_comments

        UNION ALL

        SELECT cc.id, NULL AS comicId, cc.chapterId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar
        FROM chapter_comments cc
        LEFT JOIN users u ON cc.userId = u.id
        INNER JOIN comment_tree ct ON cc.parentCommentId = ct.id
      )
    SELECT * FROM comment_tree`,
    [chapterId, limit, offset]
  );

  const total = await db.get(
    'SELECT COUNT(*) as count FROM chapter_comments WHERE chapterId = ? AND parentCommentId IS NULL',
    [chapterId]
  );

  const commentsTree = buildCommentTree(rawComments);

  return { 
    comments: commentsTree, 
    total: total?.count || 0, 
    page, 
    limit 
  };
};

export const updateChapterComment = async (commentId, content) => {
  await db.run(
    'UPDATE chapter_comments SET content = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [content, commentId]
  );
  return getChapterComment(commentId);
};

export const deleteChapterComment = async (commentId) => {
  // Delete all reactions first
  await db.run('DELETE FROM chapter_comment_reactions WHERE commentId = ?', [commentId]);
  // Delete all nested comments
  const replies = await db.all('SELECT id FROM chapter_comments WHERE parentCommentId = ?', [commentId]);
  for (let reply of replies) {
    await deleteChapterComment(reply.id);
  }
  // Delete the comment itself
  await db.run('DELETE FROM chapter_comments WHERE id = ?', [commentId]);
};

// Comic Comment Reactions
export const reactToComicComment = async (userId, commentId, reactionType) => {
  // Check if reaction already exists
  const existing = await db.get(
    'SELECT * FROM comic_comment_reactions WHERE userId = ? AND commentId = ?',
    [userId, commentId]
  );

  if (existing) {
    if (existing.reactionType === reactionType) {
      // Remove reaction if same type
      await db.run('DELETE FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [userId, commentId]);
      // Update like/dislike count
      const field = reactionType === 'like' ? 'likes' : 'dislikes';
      await db.run(`UPDATE comic_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
      return { status: 'removed', userId, commentId, reactionType };
    } else {
      // Change reaction type
      await db.run(
        'UPDATE comic_comment_reactions SET reactionType = ? WHERE userId = ? AND commentId = ?',
        [reactionType, userId, commentId]
      );
      // Update counts
      const oldField = existing.reactionType === 'like' ? 'likes' : 'dislikes';
      const newField = reactionType === 'like' ? 'likes' : 'dislikes';
      await db.run(`UPDATE comic_comments SET ${oldField} = ${oldField} - 1, ${newField} = ${newField} + 1 WHERE id = ?`, [commentId]);
    }
  } else {
    // Add new reaction
    await db.run(
      'INSERT INTO comic_comment_reactions (userId, commentId, reactionType, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [userId, commentId, reactionType]
    );
    // Update like/dislike count
    const field = reactionType === 'like' ? 'likes' : 'dislikes';
    await db.run(`UPDATE comic_comments SET ${field} = ${field} + 1 WHERE id = ?`, [commentId]);
  }

  return getComicComment(commentId);
};

export const removeComicCommentReaction = async (userId, commentId) => {
  const existing = await db.get(
    'SELECT * FROM comic_comment_reactions WHERE userId = ? AND commentId = ?',
    [userId, commentId]
  );

  if (!existing) return;

  const field = existing.reactionType === 'like' ? 'likes' : 'dislikes';
  await db.run(`UPDATE comic_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
  await db.run('DELETE FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [userId, commentId]);
  
  return getComicComment(commentId);
};

// Chapter Comment Reactions
export const reactToChapterComment = async (userId, commentId, reactionType) => {
  const existing = await db.get(
    'SELECT * FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?',
    [userId, commentId]
  );

  if (existing) {
    if (existing.reactionType === reactionType) {
      await db.run('DELETE FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [userId, commentId]);
      const field = reactionType === 'like' ? 'likes' : 'dislikes';
      await db.run(`UPDATE chapter_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
      return { status: 'removed', userId, commentId, reactionType };
    } else {
      await db.run(
        'UPDATE chapter_comment_reactions SET reactionType = ? WHERE userId = ? AND commentId = ?',
        [reactionType, userId, commentId]
      );
      const oldField = existing.reactionType === 'like' ? 'likes' : 'dislikes';
      const newField = reactionType === 'like' ? 'likes' : 'dislikes';
      await db.run(`UPDATE chapter_comments SET ${oldField} = ${oldField} - 1, ${newField} = ${newField} + 1 WHERE id = ?`, [commentId]);
    }
  } else {
    await db.run(
      'INSERT INTO chapter_comment_reactions (userId, commentId, reactionType, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [userId, commentId, reactionType]
    );
    const field = reactionType === 'like' ? 'likes' : 'dislikes';
    await db.run(`UPDATE chapter_comments SET ${field} = ${field} + 1 WHERE id = ?`, [commentId]);
  }

  return getChapterComment(commentId);
};

export const removeChapterCommentReaction = async (userId, commentId) => {
  const existing = await db.get(
    'SELECT * FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?',
    [userId, commentId]
  );

  if (!existing) return;

  const field = existing.reactionType === 'like' ? 'likes' : 'dislikes';
  await db.run(`UPDATE chapter_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
  await db.run('DELETE FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [userId, commentId]);
  
  return getChapterComment(commentId);
};
