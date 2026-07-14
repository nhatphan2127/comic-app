import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { buildCommentTree } from '../helpers/helpers.js';

export async function getComicComments(req, res, next) {
    try {
        const { comicId } = req.params;
        let { limit, offset, sortBy } = req.query;
        const safeLimit = Math.min(Number(limit) || 20, 20);
        const safeOffset = Number(offset) || 0;
        const safeSortBy = ['newest', 'oldest', 'best'].includes(sortBy) ? sortBy : 'best';
        const userId = req.user?.id || null;

        const rawComments = await db.all(
            `WITH RECURSIVE
                root_comments AS (
                    SELECT cc.id, cc.comicId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar,
                           CASE WHEN r.reactionType IS NULL THEN 'none' ELSE r.reactionType END AS userReaction
                    FROM comic_comments cc
                    LEFT JOIN users u ON cc.userId = u.id
                    LEFT JOIN comic_comment_reactions r ON r.commentId = cc.id AND r.userId = ?
                    WHERE cc.comicId = ? AND cc.parentCommentId IS NULL
                    ORDER BY cc.createdAt DESC
                    LIMIT ? OFFSET ?
                ),
                comment_tree AS (
                    SELECT id, comicId, NULL AS chapterId, userId, content, parentCommentId, createdAt, updatedAt, likes, dislikes, displayName, avatar, userReaction
                    FROM root_comments

                    UNION ALL

                    SELECT cc.id, cc.comicId, NULL AS chapterId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar,
                           CASE WHEN r.reactionType IS NULL THEN 'none' ELSE r.reactionType END AS userReaction
                    FROM comic_comments cc
                    LEFT JOIN users u ON cc.userId = u.id
                    LEFT JOIN comic_comment_reactions r ON r.commentId = cc.id AND r.userId = ?
                    INNER JOIN comment_tree ct ON cc.parentCommentId = ct.id
                )
                SELECT * FROM comment_tree`,
            [userId, comicId, safeLimit, safeOffset, userId]
        );

        const total = await db.get(
            'SELECT COUNT(*) as count FROM comic_comments WHERE comicId = ? AND parentCommentId IS NULL',
            [comicId]
        );

        const commentsTree = buildCommentTree(rawComments, safeSortBy);
        return res.json({
            status: 'success',
            data: {
                comments: commentsTree,
                total: total?.count || 0,
                offset: safeOffset,
                limit: safeLimit,
                sortBy: safeSortBy
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function postComicComment(req, res, next) {
    try {
        const { comicId } = req.params;
        const { content, parentCommentId } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ status: 'fail', message: 'Comment content is required' });
        }

        const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
        if (!comic) {
            return res.status(404).json({ status: 'fail', message: 'Comic not found' });
        }

        if (parentCommentId) {
            const parentComment = await db.get('SELECT id FROM comic_comments WHERE id = ? AND comicId = ?', [parentCommentId, comicId]);
            if (!parentComment) {
                return res.status(404).json({ status: 'fail', message: 'Parent comment not found' });
            }
        }

        const commentId = uuidv4();
        await db.run(
            `INSERT INTO comic_comments (id, comicId, userId, content, parentCommentId, likes, dislikes) VALUES (?, ?, ?, ?, ?, 0, 0)`,
            [commentId, comicId, req.user.id, content.trim(), parentCommentId || null]
        );

        return res.status(201).json({ status: 'success', data: { id: commentId, content: content.trim(), parentCommentId: parentCommentId || null, userReaction: 'none' } });
    } catch (error) {
        next(error);
    }
}

export async function getChapterComments(req, res, next) {
    try {
        const { chapterId } = req.params;
        let { limit, offset, sortBy } = req.query;
        const safeLimit = Math.min(Number(limit) || 20, 20);
        const safeOffset = Number(offset) || 0;
        const safeSortBy = ['newest', 'oldest', 'best'].includes(sortBy) ? sortBy : 'best';
        const userId = req.user?.id || null;

        const rawComments = await db.all(
            `WITH RECURSIVE
                root_comments AS (
                    SELECT cc.id, cc.chapterId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar,
                           CASE WHEN r.reactionType IS NULL THEN 'none' ELSE r.reactionType END AS userReaction
                    FROM chapter_comments cc
                    LEFT JOIN users u ON cc.userId = u.id
                    LEFT JOIN chapter_comment_reactions r ON r.commentId = cc.id AND r.userId = ?
                    WHERE cc.chapterId = ? AND cc.parentCommentId IS NULL
                    ORDER BY cc.createdAt DESC
                    LIMIT ? OFFSET ?
                ),
                comment_tree AS (
                    SELECT id, NULL AS comicId, chapterId, userId, content, parentCommentId, createdAt, updatedAt, likes, dislikes, displayName, avatar, userReaction
                    FROM root_comments

                    UNION ALL

                    SELECT cc.id, NULL AS comicId, cc.chapterId, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt, cc.likes, cc.dislikes, u.displayName, u.avatar,
                           CASE WHEN r.reactionType IS NULL THEN 'none' ELSE r.reactionType END AS userReaction
                    FROM chapter_comments cc
                    LEFT JOIN users u ON cc.userId = u.id
                    LEFT JOIN chapter_comment_reactions r ON r.commentId = cc.id AND r.userId = ?
                    INNER JOIN comment_tree ct ON cc.parentCommentId = ct.id
                )
                SELECT * FROM comment_tree`,
            [userId, chapterId, safeLimit, safeOffset, userId]
        );

        const total = await db.get(
            'SELECT COUNT(*) as count FROM chapter_comments WHERE chapterId = ? AND parentCommentId IS NULL',
            [chapterId]
        );

        const commentsTree = buildCommentTree(rawComments, safeSortBy);
        console.log(commentsTree)
        return res.json({
            status: 'success',
            data: {
                comments: commentsTree,
                total: total?.count || 0,
                offset: safeOffset,
                limit: safeLimit,
                sortBy: safeSortBy,
            },
        });
    } catch (error) {
        next(error);
    }
}

export async function postChapterComment(req, res, next) {
    try {
        const { chapterId } = req.params;
        const { content, parentCommentId } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ status: 'fail', message: 'Comment content is required' });
        }

        const chapter = await db.get('SELECT id FROM chapters WHERE id = ?', [chapterId]);
        if (!chapter) {
            return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
        }

        if (parentCommentId) {
            const parentComment = await db.get('SELECT id FROM chapter_comments WHERE id = ? AND chapterId = ?', [parentCommentId, chapterId]);
            if (!parentComment) {
                return res.status(404).json({ status: 'fail', message: 'Parent comment not found' });
            }
        }

        const commentId = uuidv4();
        await db.run(
            `INSERT INTO chapter_comments (id, chapterId, userId, content, parentCommentId, likes, dislikes) VALUES (?, ?, ?, ?, ?, 0, 0)`,
            [commentId, chapterId, req.user.id, content.trim(), parentCommentId || null]
        );

        return res.status(201).json({ status: 'success', data: { id: commentId, content: content.trim(), parentCommentId: parentCommentId || null, userReaction: 'none' } });
    } catch (error) {
        next(error);
    }
}

export async function editChapterComment(req, res, next) {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ status: 'fail', message: 'Content is required' });
        }

        const comment = await db.get('SELECT userId FROM chapter_comments WHERE id = ?', [commentId]);
        if (!comment) {
            return res.status(404).json({ status: 'fail', message: 'Comment not found' });
        }
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ status: 'fail', message: 'You can only edit your own comment' });
        }

        await db.run('UPDATE chapter_comments SET content = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [content, commentId]);
        return res.json({ status: 'success', data: { id: commentId, content } });
    } catch (error) {
        next(error);
    }
}

export async function deleteChapterComment(req, res, next) {
    try {
        const { commentId } = req.params;
        const comment = await db.get('SELECT userId FROM chapter_comments WHERE id = ?', [commentId]);
        if (!comment) {
            return res.status(404).json({ status: 'fail', message: 'Comment not found' });
        }
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ status: 'fail', message: 'You can only delete your own comment' });
        }

        // Soft delete: clear content and set deletedAt
        await db.run('UPDATE chapter_comments SET content = "", deletedAt = CURRENT_TIMESTAMP WHERE id = ?', [commentId]);
        return res.json({ status: 'success', message: 'Comment deleted successfully' });
    } catch (error) {
        next(error);
    }
}

export async function reactChapterComment(req, res, next) {
    try {
        const { commentId } = req.params;
        const { reactionType } = req.body;
        if (!reactionType || !['like', 'dislike'].includes(reactionType)) {
            return res.status(400).json({ status: 'fail', message: 'Invalid reaction type' });
        }

        const comment = await db.get('SELECT id FROM chapter_comments WHERE id = ?', [commentId]);
        if (!comment) {
            return res.status(404).json({ status: 'fail', message: 'Comment not found' });
        }

        const existing = await db.get('SELECT reactionType FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
        if (existing) {
            if (existing.reactionType === reactionType) {
                await db.run('DELETE FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
                const field = reactionType === 'like' ? 'likes' : 'dislikes';
                await db.run(`UPDATE chapter_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
            } else {
                await db.run('UPDATE chapter_comment_reactions SET reactionType = ?, createdAt = CURRENT_TIMESTAMP WHERE userId = ? AND commentId = ?', [reactionType, req.user.id, commentId]);
                const oldField = existing.reactionType === 'like' ? 'likes' : 'dislikes';
                const newField = reactionType === 'like' ? 'likes' : 'dislikes';
                await db.run(`UPDATE chapter_comments SET ${oldField} = ${oldField} - 1, ${newField} = ${newField} + 1 WHERE id = ?`, [commentId]);
            }
        } else {
            await db.run('INSERT INTO chapter_comment_reactions (userId, commentId, reactionType, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [req.user.id, commentId, reactionType]);
            const field = reactionType === 'like' ? 'likes' : 'dislikes';
            await db.run(`UPDATE chapter_comments SET ${field} = ${field} + 1 WHERE id = ?`, [commentId]);
        }

        const likesCount = await db.get('SELECT COUNT(*) AS total FROM chapter_comment_reactions WHERE commentId = ? AND reactionType = ?', [commentId, 'like']);
        const dislikesCount = await db.get('SELECT COUNT(*) AS total FROM chapter_comment_reactions WHERE commentId = ? AND reactionType = ?', [commentId, 'dislike']);
        const currentReaction = await db.get('SELECT reactionType FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);

        return res.json({
            status: 'success',
            data: {
                commentId,
                reactionType: currentReaction?.reactionType || 'none',
                likesCount: likesCount.total,
                dislikesCount: dislikesCount.total,
                userReaction: currentReaction?.reactionType || 'none',
            },
        });
    } catch (error) {
        next(error);
    }
}

export async function removeChapterCommentReaction(req, res, next) {
    try {
        const { commentId } = req.params;
        const existing = await db.get('SELECT reactionType FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
        if (existing) {
            const field = existing.reactionType === 'like' ? 'likes' : 'dislikes';
            await db.run(`UPDATE chapter_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
        }
        await db.run('DELETE FROM chapter_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
        return res.json({ status: 'success', data: { commentId, userReaction: 'none' } });
    } catch (error) {
        next(error);
    }
}

export async function editComment(req, res, next) {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ status: 'fail', message: 'Content is required' });
        }

        const comment = await db.get('SELECT userId FROM comic_comments WHERE id = ?', [commentId]);
        if (!comment) {
            return res.status(404).json({ status: 'fail', message: 'Comment not found' });
        }
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ status: 'fail', message: 'You can only edit your own comment' });
        }

        await db.run(`UPDATE comic_comments SET content = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [content, commentId]);
        return res.json({ status: 'success', data: { id: commentId, content } });
    } catch (error) {
        next(error);
    }
}

export async function deleteComment(req, res, next) {
    try {
        const { commentId } = req.params;
        const comment = await db.get('SELECT userId FROM comic_comments WHERE id = ?', [commentId]);
        if (!comment) {
            return res.status(404).json({ status: 'fail', message: 'Comment not found' });
        }
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ status: 'fail', message: 'You can only delete your own comment' });
        }

        // Soft delete: clear content and set deletedAt
        await db.run(`UPDATE comic_comments SET content = "", deletedAt = CURRENT_TIMESTAMP WHERE id = ?`, [commentId]);
        return res.json({ status: 'success', message: 'Comment deleted successfully' });
    } catch (error) {
        next(error);
    }
}

export async function reactComment(req, res, next) {
    try {
        const { commentId } = req.params;
        const { reactionType } = req.body;
        if (!reactionType || !['like', 'dislike'].includes(reactionType)) {
            return res.status(400).json({ status: 'fail', message: 'Invalid reaction type' });
        }

        const comment = await db.get('SELECT id FROM comic_comments WHERE id = ?', [commentId]);
        if (!comment) {
            return res.status(404).json({ status: 'fail', message: 'Comment not found' });
        }

        const existing = await db.get('SELECT reactionType FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
        if (existing) {
            if (existing.reactionType === reactionType) {
                await db.run('DELETE FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
                const field = reactionType === 'like' ? 'likes' : 'dislikes';
                await db.run(`UPDATE comic_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
            } else {
                await db.run('UPDATE comic_comment_reactions SET reactionType = ?, createdAt = CURRENT_TIMESTAMP WHERE userId = ? AND commentId = ?', [reactionType, req.user.id, commentId]);
                const oldField = existing.reactionType === 'like' ? 'likes' : 'dislikes';
                const newField = reactionType === 'like' ? 'likes' : 'dislikes';
                await db.run(`UPDATE comic_comments SET ${oldField} = ${oldField} - 1, ${newField} = ${newField} + 1 WHERE id = ?`, [commentId]);
            }
        } else {
            await db.run('INSERT INTO comic_comment_reactions (userId, commentId, reactionType) VALUES (?, ?, ?)', [req.user.id, commentId, reactionType]);
            const field = reactionType === 'like' ? 'likes' : 'dislikes';
            await db.run(`UPDATE comic_comments SET ${field} = ${field} + 1 WHERE id = ?`, [commentId]);
        }

        const likesCount = await db.get('SELECT COUNT(*) AS total FROM comic_comment_reactions WHERE commentId = ? AND reactionType = ?', [commentId, 'like']);
        const dislikesCount = await db.get('SELECT COUNT(*) AS total FROM comic_comment_reactions WHERE commentId = ? AND reactionType = ?', [commentId, 'dislike']);
        const currentReaction = await db.get('SELECT reactionType FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);

        return res.json({
            status: 'success',
            data: {
                commentId,
                reactionType: currentReaction?.reactionType || 'none',
                likesCount: likesCount.total,
                dislikesCount: dislikesCount.total,
                userReaction: currentReaction?.reactionType || 'none'
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function removeCommentReaction(req, res, next) {
    try {
        const { commentId } = req.params;
        const existing = await db.get('SELECT reactionType FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
        if (existing) {
            const field = existing.reactionType === 'like' ? 'likes' : 'dislikes';
            await db.run(`UPDATE comic_comments SET ${field} = ${field} - 1 WHERE id = ?`, [commentId]);
        }
        await db.run('DELETE FROM comic_comment_reactions WHERE userId = ? AND commentId = ?', [req.user.id, commentId]);
        return res.json({ status: 'success', data: { commentId, userReaction: 'none' } });
    } catch (error) {
        next(error);
    }
}

export async function getUserComments(req, res, next) {
    try {
        const userId = req.user.id;
        let { sortBy } = req.query;
        const safeSortBy = ['recent', 'most-liked', 'most-replies'].includes(sortBy) ? sortBy : 'recent';

        // Query both comic and chapter comments
        // Note: For 'most-replies', we'll need a subquery to count children
        const query = `
            SELECT * FROM (
                SELECT 
                    cc.id, cc.content, cc.createdAt, cc.likes, cc.dislikes,
                    c.name AS targetName, c.url AS targetUrl, c.coverUrl AS targetCoverUrl,
                    'comic' as type,
                    (SELECT COUNT(*) FROM comic_comments WHERE parentCommentId = cc.id) as replyCount
                FROM comic_comments cc
                JOIN comics c ON cc.comicId = c.id
                WHERE cc.userId = ? AND cc.deletedAt IS NULL

                UNION ALL

                SELECT 
                    cc.id, cc.content, cc.createdAt, cc.likes, cc.dislikes,
                    c.name AS targetName, c.url AS targetUrl, c.coverUrl AS targetCoverUrl,
                    'chapter' as type,
                    (SELECT COUNT(*) FROM chapter_comments WHERE parentCommentId = cc.id) as replyCount
                FROM chapter_comments cc
                JOIN chapters ch ON cc.chapterId = ch.id
                JOIN comics c ON ch.comicId = c.id
                WHERE cc.userId = ? AND cc.deletedAt IS NULL
            ) AS combined_comments
            ORDER BY 
                CASE WHEN ? = 'recent' THEN createdAt END DESC,
                CASE WHEN ? = 'most-liked' THEN likes END DESC,
                CASE WHEN ? = 'most-replies' THEN replyCount END DESC
        `;

        const comments = await db.all(query, [userId, userId, safeSortBy, safeSortBy, safeSortBy]);

        return res.json({
            status: 'success',
            data: comments
        });
    } catch (error) {
        next(error);
    }
}
