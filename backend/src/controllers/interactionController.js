import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// use /:comicId/follow
export async function getFollowStatus(req, res, next) {
  try {
    const { comicId } = req.params;
    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    const relation = await db.get('SELECT 1 FROM following WHERE userId = ? AND comicId = ?', [req.user.id, comicId]);
    return res.json({ status: 'success', data: { isFollowing: Boolean(relation) } });
  } catch (error) {
    next(error);
  }
}

//post('/:comicId/follow'
export async function followComic(req, res, next) {
  try {
    const { comicId } = req.params;
    const { categoryId } = req.body || {};
    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    if (categoryId) {
      const category = await db.get('SELECT id FROM following_categories WHERE id = ? AND (userId IS NULL OR userId = ?)', [categoryId, req.user.id]);
      if (!category) {
        return res.status(404).json({ status: 'fail', message: 'Following category not found' });
      }
    }

    const existing = await db.get('SELECT id FROM following WHERE userId = ? AND comicId = ?', [req.user.id, comicId]);
    if (!existing) {
      await db.run(
        `INSERT INTO following (id, userId, comicId, followingCategoryId) VALUES (?, ?, ?, ?)`,
        [uuidv4(), req.user.id, comicId, categoryId || null]
      );
      await db.run(`UPDATE comics SET follow = follow + 1 WHERE id = ?`, [comicId]);
    } else {
      await db.run(
        `UPDATE following SET followingCategoryId = ? WHERE userId = ? AND comicId = ?`,
        [categoryId || null, req.user.id, comicId]
      );
    }

    return res.json({ status: 'success', data: { isFollowing: true } });
  } catch (error) {
    next(error);
  }
}

// delete('/:comicId/follow'
export async function unfollowComic(req, res, next) {
  try {
    const { comicId } = req.params;
    const existing = await db.get('SELECT id FROM following WHERE userId = ? AND comicId = ?', [req.user.id, comicId]);
    if (existing) {
      await db.run(`DELETE FROM following WHERE userId = ? AND comicId = ?`, [req.user.id, comicId]);
      await db.run(`UPDATE comics SET follow = MAX(follow - 1, 0) WHERE id = ?`, [comicId]);
    }
    return res.json({ status: 'success', data: { isFollowing: false } });
  } catch (error) {
    next(error);
  }
}

export async function bookmarkComic(req, res, next) {
  try {
    const { comicId } = req.params;
    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }
    await db.run(`INSERT OR IGNORE INTO bookmarks (userId, comicId) VALUES (?, ?)`, [req.user.id, comicId]);
    return res.json({ status: 'success', data: { isBookmarked: true } });
  } catch (error) {
    next(error);
  }
}

export async function unbookmarkComic(req, res, next) {
  try {
    const { comicId } = req.params;
    await db.run(`DELETE FROM bookmarks WHERE userId = ? AND comicId = ?`, [req.user.id, comicId]);
    return res.json({ status: 'success', message: 'Successfully removed from bookmarks' });
  } catch (error) {
    next(error);
  }
}

// router.post('/:comicId/rate',
export async function rateComic(req, res, next) {
  try {
    const { comicId } = req.params;
    const { rating } = req.body;
    const parsed = Number(rating);
    if (!parsed || parsed < 1 || parsed > 5) {
      return res.status(400).json({ status: 'fail', message: 'Rating must be a value between 1 and 5' });
    }

    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    const existing = await db.get('SELECT rating FROM rating_history WHERE userId = ? AND comicId = ?', [req.user.id, comicId]);
    if (existing) {
      await db.run(`UPDATE rating_history SET rating = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND comicId = ?`, [parsed, req.user.id, comicId]);
    } else {
      await db.run(`INSERT INTO rating_history (userId, comicId, rating) VALUES (?, ?, ?)`, [req.user.id, comicId, parsed]);
    }

    const ratings = await db.all('SELECT rating FROM rating_history WHERE comicId = ?', [comicId]);
    const average = ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : 0;
    await db.run(`UPDATE comics SET rating = ? WHERE id = ?`, [average, comicId]);

    return res.json({ status: 'success', data: { comicId, newAverageRating: Number(average.toFixed(1)), userRating: parsed } });
  } catch (error) {
    next(error);
  }
}

// router.post('/chapters/:chapterId/history',
export async function saveReadingHistory(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { currentPage } = req.body;
    const page = Number(currentPage) || 1;
    const chapter = await db.get('SELECT id FROM chapters WHERE id = ?', [chapterId]);
    if (!chapter) {
      return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
    }

    await db.run(
      `INSERT OR REPLACE INTO read_history (userId, chapterId, currentPage, readAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.id, chapterId, page]
    );

    return res.json({ status: 'success', data: { chapterId, currentPage: page, readAt: new Date().toISOString() } });
  } catch (error) {
    next(error);
  }
}
