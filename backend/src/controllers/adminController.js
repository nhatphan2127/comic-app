import db from '../config/database.js';

export async function assignUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ status: 'fail', message: 'Role is required' });
    }

    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    return res.json({ status: 'success', data: { userId, role } });
  } catch (error) {
    next(error);
  }
}

export async function getModerationQueue(req, res, next) {
  try {
    const { comicStatus, chapterStatus } = req.query;
    const allowedStatuses = ['pending', 'accept', 'reject'];
    
    const comicStatuses = comicStatus && allowedStatuses.includes(comicStatus) ? [comicStatus] : allowedStatuses;
    const chapterStatuses = chapterStatus && allowedStatuses.includes(chapterStatus) ? [chapterStatus] : allowedStatuses;

    const comicPlaceholders = comicStatuses.map(() => '?').join(',');
    const chapterPlaceholders = chapterStatuses.map(() => '?').join(',');

    const [comics, chapters] = await Promise.all([
      db.all(
        `SELECT id, name, url, coverUrl, status, createdAt, updatedAt FROM comics WHERE status IN (${comicPlaceholders}) ORDER BY updatedAt DESC`,
        comicStatuses
      ),
      db.all(
        `SELECT id, comicId, title, chapterNumber, url, status, createdAt, updatedAt FROM chapters WHERE status IN (${chapterPlaceholders}) ORDER BY updatedAt DESC`,
        chapterStatuses
      ),
    ]);

    return res.json({ status: 'success', data: { comics, chapters } });
  } catch (error) {
    next(error);
  }
}

export async function getAdminComics(req, res, next) {
  try {
    const { status } = req.query;
    const allowedStatuses = ['pending', 'accept', 'reject'];
    const selectedStatus = typeof status === 'string' && allowedStatuses.includes(status) ? status : null;

    const query = selectedStatus
      ? `SELECT id, name, url, coverUrl, status, createdAt, updatedAt FROM comics WHERE status = ? ORDER BY updatedAt DESC`
      : `SELECT id, name, url, coverUrl, status, createdAt, updatedAt FROM comics ORDER BY updatedAt DESC`;

    const params = selectedStatus ? [selectedStatus] : [];
    const comics = await db.all(query, params);

    return res.json({ status: 'success', data: comics });
  } catch (error) {
    next(error);
  }
}

export async function getAdminChapters(req, res, next) {
  try {
    const { status } = req.query;
    const allowedStatuses = ['pending', 'accept', 'reject'];
    const selectedStatus = typeof status === 'string' && allowedStatuses.includes(status) ? status : null;

    const query = selectedStatus
      ? `SELECT id, comicId, title, chapterNumber, url, status, createdAt, updatedAt FROM chapters WHERE status = ? ORDER BY updatedAt DESC`
      : `SELECT id, comicId, title, chapterNumber, url, status, createdAt, updatedAt FROM chapters ORDER BY updatedAt DESC`;

    const params = selectedStatus ? [selectedStatus] : [];
    const chapters = await db.all(query, params);

    return res.json({ status: 'success', data: chapters });
  } catch (error) {
    next(error);
  }
}

export async function getModerationComicDetail(req, res, next) {
  try {
    const { comicId } = req.params;
    const comic = await db.get(
      `SELECT c.id, c.name, c.description, c.types, c.contentRating,
              c.demographic, c.rating, c.coverUrl, c.view, c.follow, 
              c.releaseStatus, c.visibility, c.url, c.releasingYear, 
              c.source, a.name AS authorName, ar.name AS artistName, c.status
       FROM comics c
       LEFT JOIN author a ON c.authorId = a.id
       LEFT JOIN artist ar ON c.artistId = ar.id
       WHERE c.id = ?`,
      [comicId]
    );

    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    const [genres, formats] = await Promise.all([
      db.all(`SELECT g.name FROM genres g JOIN comic_genres cg ON g.id = cg.genreId WHERE cg.comicId = ?`, [comic.id]),
      db.all(`SELECT f.name FROM formats f JOIN comic_formats cf ON f.id = cf.formatId WHERE cf.comicId = ?`, [comic.id]),
    ]);

    return res.json({
      status: 'success',
      data: {
        id: comic.id,
        name: comic.name,
        description: comic.description,
        coverUrl: comic.coverUrl,
        source: comic.source,
        types: comic.types,
        contentRating: comic.contentRating,
        demographic: comic.demographic,
        rating: comic.rating,
        view: comic.view,
        follow: comic.follow,
        releaseStatus: comic.releaseStatus,
        status: comic.status,
        visibility: comic.visibility,
        url: comic.url,
        releasingYear: comic.releasingYear,
        author: comic.authorName,
        artist: comic.artistName,
        genres: genres.map((g) => g.name),
        formats: formats.map((f) => f.name),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewSubmission(req, res, next) {
  try {
    const { targetType, targetId } = req.params;
    const { status } = req.body;

    if (!['accept', 'reject'].includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid status' });
    }

    if (targetType === 'comic') {
      const comic = await db.get('SELECT id FROM comics WHERE id = ?', [targetId]);
      if (!comic) {
        return res.status(404).json({ status: 'fail', message: 'Comic not found' });
      }
      await db.run('UPDATE comics SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [status, targetId]);
      await db.run('UPDATE comic_contributors SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE comicId = ?', [status, targetId]);
      return res.json({ status: 'success', data: { targetType, targetId, status } });
    }

    if (targetType === 'chapter') {
      const chapter = await db.get('SELECT id FROM chapters WHERE id = ?', [targetId]);
      if (!chapter) {
        return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
      }
      await db.run('UPDATE chapters SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [status, targetId]);
      await db.run('UPDATE chapter_contributors SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE chapterId = ?', [status, targetId]);
      return res.json({ status: 'success', data: { targetType, targetId, status } });
    }

    return res.status(400).json({ status: 'fail', message: 'Unsupported target type' });
  } catch (error) {
    next(error);
  }
}

export async function getAdminDashboard(req, res, next) {
  try {
    const [autoAcceptRow, users, comments, pendingComics, pendingChapters] = await Promise.all([
      db.get('SELECT value FROM admin_settings WHERE key = ?', ['auto_accept']),
      db.all('SELECT id, username, displayName, email, role, isBanned, createdAt FROM users ORDER BY createdAt DESC LIMIT 100'),
      db.all(`SELECT 'comic' AS source, id, userId, comicId AS targetId, content, isBanned, createdAt FROM comic_comments ORDER BY createdAt DESC LIMIT 50`),
      db.all(`SELECT id, name, url, coverUrl, status, createdAt, updatedAt FROM comics WHERE status = 'pending' ORDER BY updatedAt DESC LIMIT 10`),
      db.all(`SELECT id, comicId, title, chapterNumber, url, status, createdAt, updatedAt FROM chapters WHERE status = 'pending' ORDER BY updatedAt DESC LIMIT 10`),
    ]);

    const chapterComments = await db.all(`SELECT 'chapter' AS source, id, userId, chapterId AS targetId, content, isBanned, createdAt FROM chapter_comments ORDER BY createdAt DESC LIMIT 50`);
    const combinedComments = [...comments, ...chapterComments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      status: 'success',
      data: {
        autoAccept: autoAcceptRow?.value === 'true',
        users,
        comments: combinedComments,
        comics: pendingComics,
        chapters: pendingChapters,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function setAutoAccept(req, res, next) {
  try {
    const { enabled } = req.body;
    await db.run('INSERT INTO admin_settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP', ['auto_accept', String(Boolean(enabled))]);
    return res.json({ status: 'success', data: { enabled: Boolean(enabled) } });
  } catch (error) {
    next(error);
  }
}

export async function updateComicStatus(req, res, next) {
  try {
    const { comicId } = req.params;
    const { status } = req.body;

    if (!['accept', 'reject'].includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid status' });
    }

    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    await db.run('UPDATE comics SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [status, comicId]);
    await db.run('UPDATE comic_contributors SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE comicId = ?', [status, comicId]);

    return res.json({ status: 'success', data: { comicId, status } });
  } catch (error) {
    next(error);
  }
}

export async function updateChapterStatus(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { status } = req.body;

    if (!['accept', 'reject'].includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid status' });
    }

    const chapter = await db.get('SELECT id FROM chapters WHERE id = ?', [chapterId]);
    if (!chapter) {
      return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
    }

    await db.run('UPDATE chapters SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [status, chapterId]);
    await db.run('UPDATE chapter_contributors SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE chapterId = ?', [status, chapterId]);

    return res.json({ status: 'success', data: { chapterId, status } });
  } catch (error) {
    next(error);
  }
}

export async function toggleUserBan(req, res, next) {
  try {
    const { userId } = req.params;
    const { isBanned } = req.body;
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }
    await db.run('UPDATE users SET isBanned = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [Number(Boolean(isBanned)), userId]);
    return res.json({ status: 'success', data: { userId, isBanned: Boolean(isBanned) } });
  } catch (error) {
    next(error);
  }
}

export async function toggleCommentBan(req, res, next) {
  try {
    const { targetType, commentId } = req.params;
    const { isBanned } = req.body;
    if (targetType === 'comic') {
      await db.run('UPDATE comic_comments SET isBanned = ? WHERE id = ?', [Number(Boolean(isBanned)), commentId]);
      return res.json({ status: 'success', data: { targetType, commentId, isBanned: Boolean(isBanned) } });
    }
    if (targetType === 'chapter') {
      await db.run('UPDATE chapter_comments SET isBanned = ? WHERE id = ?', [Number(Boolean(isBanned)), commentId]);
      return res.json({ status: 'success', data: { targetType, commentId, isBanned: Boolean(isBanned) } });
    }
    return res.status(400).json({ status: 'fail', message: 'Unsupported target type' });
  } catch (error) {
    next(error);
  }
}

export async function forceDeleteComicComment(req, res, next) {
  try {
    const { commentId } = req.params;
    await db.run('DELETE FROM comic_comments WHERE id = ?', [commentId]);
    return res.json({ status: 'success', message: 'The comment was force-removed by the administration team' });
  } catch (error) {
    next(error);
  }
}

export async function forceDeleteChapterComment(req, res, next) {
  try {
    const { commentId } = req.params;
    await db.run('DELETE FROM chapter_comments WHERE id = ?', [commentId]);
    return res.json({ status: 'success', message: 'The chapter comment was force-removed by the administration team' });
  } catch (error) {
    next(error);
  }
}

export async function updateComicVisibility(req, res, next) {
  try {
    const { comicId } = req.params;
    const { visibility } = req.body;

    if (!['public', 'hidden'].includes(visibility)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid visibility value' });
    }

    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    await db.run('UPDATE comics SET visibility = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [visibility, comicId]);
    return res.json({ status: 'success', data: { comicId, visibility } });
  } catch (error) {
    next(error);
  }
}

export async function updateChapterVisibility(req, res, next) {
  try {
    const { chapterId } = req.params;
    const { visibility } = req.body;

    if (!['public', 'hidden'].includes(visibility)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid visibility value' });
    }

    const chapter = await db.get('SELECT id FROM chapters WHERE id = ?', [chapterId]);
    if (!chapter) {
      return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
    }

    await db.run('UPDATE chapters SET visibility = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [visibility, chapterId]);
    return res.json({ status: 'success', data: { chapterId, visibility } });
  } catch (error) {
    next(error);
  }
}

export async function getAdminComicsForDashboard(req, res, next) {
  try {
    const visibility = req.query.visibility || null;
    let query = 'SELECT id, name, url, coverUrl, visibility, status, createdAt, updatedAt FROM comics';
    const params = [];

    if (visibility) {
      query += ' WHERE visibility = ?';
      params.push(visibility);
    }

    query += ' ORDER BY updatedAt DESC LIMIT 100';
    const comics = await db.all(query, params);
    
    return res.json({ status: 'success', data: comics });
  } catch (error) {
    next(error);
  }
}

export async function getAdminChaptersForDashboard(req, res, next) {
  try {
    const visibility = req.query.visibility || null;
    let query = 'SELECT id, comicId, title, chapterNumber, url, visibility, status, createdAt, updatedAt FROM chapters';
    const params = [];

    if (visibility) {
      query += ' WHERE visibility = ?';
      params.push(visibility);
    }

    query += ' ORDER BY updatedAt DESC LIMIT 100';
    const chapters = await db.all(query, params);
    
    return res.json({ status: 'success', data: chapters });
  } catch (error) {
    next(error);
  }
}
