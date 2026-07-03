import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

async function getOrCreateEntity(table, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;

  const existing = await db.get(
    `SELECT id FROM ${table} WHERE lower(name) = lower(?)`,
    [trimmed]
  );

  if (existing) {
    return existing.id;
  }

  const id = uuidv4();
  await db.run(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, trimmed]);
  return id;
}

async function normalizeValues(values, table) {
  const items = Array.isArray(values) ? values : values ? [values] : [];
  const ids = [];

  for (const value of items) {
    const trimmed = String(value || '').trim();
    if (!trimmed) continue;

    const existing = await db.get(
      `SELECT id FROM ${table} WHERE lower(name) = lower(?)`,
      [trimmed]
    );

    if (existing) {
      ids.push(existing.id);
    } else {
      const id = uuidv4();
      await db.run(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, trimmed]);
      ids.push(id);
    }
  }

  return ids;
}

export async function listComics(req, res, next) {
  try {
    const { page = 1 } = req.query;
    const { contentRating } = req.body;

    const limit = 20;
    const offset = (Number(page) - 1) * limit;

    const filters = [];
    const params = [];

    // Filter content rating
    if (Array.isArray(contentRating) && contentRating.length > 0) {
      filters.push(
        `contentRating IN (${contentRating.map(() => "?").join(",")})`
      );
      params.push(...contentRating);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Lấy danh sách comic
    const comics = await db.all(
      `
      SELECT id, name, types, coverUrl, view, follow, url
      FROM comics
      ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const comicIds = comics.map((comic) => comic.id);

    let chapters = [];

    // Chỉ query chapter nếu có comic
    if (comicIds.length > 0) {
      chapters = await db.all(
        `
        SELECT comicId, id, chapterNumber, title, updatedAt
        FROM chapters
        WHERE comicId IN (${comicIds.map(() => "?").join(",")})
        ORDER BY comicId, chapterNumber DESC
        `,
        comicIds
      );
    }

    // Gom tối đa 3 chapter mới nhất
    const latest = {};

    chapters.forEach((chapter) => {
      if (!latest[chapter.comicId]) {
        latest[chapter.comicId] = [];
      }

      if (latest[chapter.comicId].length < 3) {
        latest[chapter.comicId].push({
          id: chapter.id,
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          updatedAt: chapter.updatedAt
        });
      }
    });

    const result = comics.map((comic) => ({
      ...comic,
      latestChapters: latest[comic.id] || [],
    }));

    const countRow = await db.get(
      `
      SELECT COUNT(*) AS total
      FROM comics
      ${whereClause}
      `,
      params
    );

    const totalPages = Math.ceil((countRow?.total || 0) / limit);

    return res.json({
      status: "success",
      data: {
        comics: result,
        pagination: {
          page: Number(page),
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function popularComics(req, res, next) {
  try {
    const list = await db.all(`SELECT * FROM comics ORDER BY view DESC LIMIT 10`);
    return res.json({ status: 'success', data: list });
  } catch (error) {
    next(error);
  }
}

export async function getComicDetail(req, res, next) {
  try {
    const { comicUrl } = req.params;
    const comic = await db.get(
      `SELECT c.id, c.name, c.description, c.types, c.contentRating, c.demographic, c.rating, c.coverUrl, c.view, c.follow, c.releaseStatus, c.status, c.visibility, c.url, c.releasingYear, c.source, a.name AS authorName, ar.name AS artistName
       FROM comics c
       LEFT JOIN author a ON c.authorId = a.id
       LEFT JOIN artist ar ON c.artistId = ar.id
       WHERE c.url = ?`,
      [comicUrl]
    );

    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }
    console.log([req.user.id, comic.id])
    const [genres, formats, chapters, userRatingRow] = await Promise.all([
      db.all(`SELECT g.name FROM genres g JOIN comic_genres cg ON g.id = cg.genreId WHERE cg.comicId = ?`, [comic.id]),
      db.all(`SELECT f.name FROM formats f JOIN comic_formats cf ON f.id = cf.formatId WHERE cf.comicId = ?`, [comic.id]),
      db.all(`SELECT id, chapterNumber, title, url, createdAt, updatedAt FROM chapters WHERE comicId = ? ORDER BY chapterNumber ASC`, [comic.id]),
      req.user?.id
        ? db.get('SELECT rating FROM rating_history WHERE userId = ? AND comicId = ?', [req.user.id, comic.id])
        : Promise.resolve(null),
    ]);

    return res.json({
      status: 'success',
      data: {
        id: comic.id,
        name: comic.name,
        names: [{ name: comic.name, country: 'global' }],
        description: comic.description,
        coverUrl: comic.coverUrl,
        source: comic.source,
        types: comic.types,
        contentRating: comic.contentRating,
        demographic: comic.demographic,
        rating: comic.rating,
        userRating: userRatingRow?.rating ? Number(userRatingRow.rating) : 0,
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
        tags: [],
        formats: formats.map((f) => f.name),
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          url: chapter.url,
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
        })),

      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getChapterDetail(req, res, next) {
  try {
    const { chapterId } = req.params;

    const chapter = await db.get(`SELECT id, chapterNumber, title FROM chapters WHERE id = ?`, [chapterId]);
    if (!chapter) {
      return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
    }

    const images = await db.all(`SELECT pageNumber, urlPath FROM chapter_images WHERE chapterId = ? ORDER BY pageNumber ASC`, [chapter.id]);

    if (req.user) {
      await db.run(
        `INSERT OR REPLACE INTO read_history (userId, chapterId, scrollPosition, currentPage, readAt) VALUES (?, ?, COALESCE((SELECT scrollPosition FROM read_history WHERE userId = ? AND chapterId = ?), 0), COALESCE((SELECT currentPage FROM read_history WHERE userId = ? AND chapterId = ?), 1), CURRENT_TIMESTAMP)`,
        [req.user.id, chapter.id, req.user.id, chapter.id, req.user.id, chapter.id]
      );
    }

    const readHistory = req.user ? await db.get(`SELECT scrollPosition, currentPage FROM read_history WHERE userId = ? AND chapterId = ?`, [req.user.id, chapter.id]) : null;

    return res.json({ status: 'success', data: { id: chapter.id, chapterNumber: chapter.chapterNumber, title: chapter.title, images, readHistory } });
  } catch (error) {
    next(error);
  }
}

export async function createComic(req, res, next) {
  try {
    const {
      name,
      source,
      types,
      contentRating = 'safe',
      demographic,
      description,
      url,
      author,
      artist,
      genres,
      formats,
      releaseStatus = 'releasing',
      releasingYear,
    } = req.body;
    const coverImage = req.file;

    if (!name || !types || !demographic || !url || !coverImage) {
      return res.status(400).json({ status: 'fail', message: 'Missing required comic fields or cover image' });
    }

    const existing = await db.get('SELECT id FROM comics WHERE url = ?', [url]);
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Comic URL already exists' });
    }

    const authorId = author ? await getOrCreateEntity('author', author) : null;
    const artistId = artist ? await getOrCreateEntity('artist', artist) : null;
    const genreIds = await normalizeValues(genres, 'genres');
    const formatIds = await normalizeValues(formats, 'formats');

    const id = uuidv4();
    const coverUrl = `comics/${coverImage.filename}`;
    await db.run(
      `INSERT INTO comics (id, name, source, types, contentRating, demographic, description, coverUrl, url, authorId, artistId, status, visibility, releaseStatus, releasingYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'public', ?, ?)`,
      [id, name, source || null, types.toLowerCase(), contentRating, demographic.toLowerCase(), description || null, coverUrl, url, authorId || null, artistId || null, releaseStatus.toLowerCase(), releasingYear ? Number(releasingYear) : null]
    );

    for (const genreId of genreIds) {
      await db.run(`INSERT OR IGNORE INTO comic_genres (comicId, genreId) VALUES (?, ?)`, [id, genreId]);
    }
    for (const formatId of formatIds) {
      await db.run(`INSERT OR IGNORE INTO comic_formats (comicId, formatId) VALUES (?, ?)`, [id, formatId]);
    }
    await db.run(`INSERT OR IGNORE INTO comic_contributors (comicId, userId, role) VALUES (?, ?, 'uploader')`, [id, req.user.id]);

    return res.status(201).json({ status: 'success', data: { id, name, coverUrl, status: 'approved' } });
  } catch (error) {
    next(error);
  }
}

export async function createChapter(req, res, next) {
  try {
    const { comicId } = req.params;
    const { title, chapterNumber, url } = req.body;
    const files = req.files;

    if (!title || !chapterNumber || !url || !files || !files.length) {
      return res.status(400).json({ status: 'fail', message: 'Missing required chapter fields or images' });
    }

    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    const existing = await db.get('SELECT id FROM chapters WHERE url = ?', [url]);
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Chapter URL already exists' });
    }

    const chapterId = uuidv4();
    await db.run(
      `INSERT INTO chapters (id, comicId, title, chapterNumber, url, status, visibility) VALUES (?, ?, ?, ?, ?, 'approved', 'public')`,
      [chapterId, comicId, title, Number(chapterNumber), url]
    );

    let pageNumber = 1;
    for (const file of files) {
      const imageId = uuidv4();
      const imagePath = `chapter-images/${file.filename}`;
      await db.run(`INSERT INTO chapter_images (id, chapterId, urlPath, pageNumber) VALUES (?, ?, ?, ?)`, [imageId, chapterId, imagePath, pageNumber]);
      pageNumber += 1;
    }

    await db.run(`INSERT OR IGNORE INTO chapter_contributors (chapterId, userId, role) VALUES (?, ?, 'uploader')`, [chapterId, req.user.id]);

    return res.status(201).json({ status: 'success', data: { chapterId, chapterNumber: Number(chapterNumber), title, imagesCount: files.length, status: 'approved' } });
  } catch (error) {
    next(error);
  }
}

// Get all comic contributions for current user
export async function getMyComicContributions(req, res, next) {
  try {
    const userId = req.user.id;

    const contributions = await db.all(
      `
      SELECT 
        cc.comicId, cc.userId, cc.role, cc.status, cc.unread, cc.createdAt, cc.updatedAt,
        c.id, c.name, c.coverUrl, c.url, c.types, c.demographic
      FROM comic_contributors cc
      JOIN comics c ON cc.comicId = c.id
      WHERE cc.userId = ?
      ORDER BY cc.updatedAt DESC
      `,
      [userId]
    );

    const result = contributions.map(row => ({
      comicId: row.comicId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      unread: row.unread,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      comic: {
        id: row.id,
        name: row.name,
        coverUrl: row.coverUrl,
        url: row.url,
        types: row.types,
        demographic: row.demographic
      }
    }));

    return res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

// Get all chapter contributions for current user
export async function getMyChapterContributions(req, res, next) {
  try {
    const userId = req.user.id;

    const contributions = await db.all(
      `
      SELECT 
        sch.chapterId, sch.userId, sch.role, sch.status, sch.unread, sch.createdAt, sch.updatedAt,
        ch.id, ch.chapterNumber, ch.title, ch.url, ch.comicId,
        c.name as comicName, c.coverUrl as comicCoverUrl
      FROM chapter_contributors sch
      JOIN chapters ch ON sch.chapterId = ch.id
      JOIN comics c ON ch.comicId = c.id
      WHERE sch.userId = ?
      ORDER BY sch.updatedAt DESC
      `,
      [userId]
    );

    const result = contributions.map(row => ({
      chapterId: row.chapterId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      unread: row.unread,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      chapter: {
        id: row.id,
        chapterNumber: row.chapterNumber,
        title: row.title,
        url: row.url,
        comicId: row.comicId
      },
      comic: {
        name: row.comicName,
        coverUrl: row.comicCoverUrl
      }
    }));

    return res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

// Update comic contributor status (accept/reject)
export async function updateComicContributorStatus(req, res, next) {
  try {
    const { comicId, userId } = req.params;
    const { status } = req.body;

    if (!['accept', 'reject'].includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid status. Must be accept or reject.' });
    }

    const contributor = await db.get(
      'SELECT * FROM comic_contributors WHERE comicId = ? AND userId = ?',
      [comicId, userId]
    );

    if (!contributor) {
      return res.status(404).json({ status: 'fail', message: 'Contributor not found' });
    }

    await db.run(
      'UPDATE comic_contributors SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE comicId = ? AND userId = ?',
      [status, comicId, userId]
    );

    return res.json({ status: 'success', data: { comicId, userId, status, updatedAt: new Date().toISOString() } });
  } catch (error) {
    next(error);
  }
}

// Mark comic contributor as read
export async function markComicContributorRead(req, res, next) {
  try {
    const { comicId, userId } = req.params;

    const contributor = await db.get(
      'SELECT * FROM comic_contributors WHERE comicId = ? AND userId = ?',
      [comicId, userId]
    );

    if (!contributor) {
      return res.status(404).json({ status: 'fail', message: 'Contributor not found' });
    }

    await db.run(
      'UPDATE comic_contributors SET unread = 0 WHERE comicId = ? AND userId = ?',
      [comicId, userId]
    );

    return res.json({ status: 'success', data: { comicId, userId, unread: 0 } });
  } catch (error) {
    next(error);
  }
}

// Update chapter contributor status (accept/reject)
export async function updateChapterContributorStatus(req, res, next) {
  try {
    const { chapterId, userId } = req.params;
    const { status } = req.body;

    if (!['accept', 'reject'].includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid status. Must be accept or reject.' });
    }

    const contributor = await db.get(
      'SELECT * FROM chapter_contributors WHERE chapterId = ? AND userId = ?',
      [chapterId, userId]
    );

    if (!contributor) {
      return res.status(404).json({ status: 'fail', message: 'Contributor not found' });
    }

    await db.run(
      'UPDATE chapter_contributors SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE chapterId = ? AND userId = ?',
      [status, chapterId, userId]
    );

    return res.json({ status: 'success', data: { chapterId, userId, status, updatedAt: new Date().toISOString() } });
  } catch (error) {
    next(error);
  }
}

// Mark chapter contributor as read
export async function markChapterContributorRead(req, res, next) {
  try {
    const { chapterId, userId } = req.params;

    const contributor = await db.get(
      'SELECT * FROM chapter_contributors WHERE chapterId = ? AND userId = ?',
      [chapterId, userId]
    );

    if (!contributor) {
      return res.status(404).json({ status: 'fail', message: 'Contributor not found' });
    }

    await db.run(
      'UPDATE chapter_contributors SET unread = 0 WHERE chapterId = ? AND userId = ?',
      [chapterId, userId]
    );

    return res.json({ status: 'success', data: { chapterId, userId, unread: 0 } });
  } catch (error) {
    next(error);
  }
}

// Get contributors for a specific chapter (admin / moderator view)
export async function getContributorsByChapter(req, res, next) {
  try {
    const { chapterId } = req.params;
    const chapter = await db.get('SELECT id, comicId, title FROM chapters WHERE id = ?', [chapterId]);
    if (!chapter) {
      return res.status(404).json({ status: 'fail', message: 'Chapter not found' });
    }

    const contributors = await db.all(
      `SELECT cc.chapterId, cc.userId, cc.role, cc.status, cc.unread, cc.createdAt, cc.updatedAt, u.displayName, u.avatar
       FROM chapter_contributors cc
       LEFT JOIN users u ON cc.userId = u.id
       WHERE cc.chapterId = ?
       ORDER BY cc.updatedAt DESC`,
      [chapterId]
    );

    const result = contributors.map((row) => ({
      chapterId: row.chapterId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      unread: row.unread,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.userId,
        displayName: row.displayName,
        avatar: row.avatar,
      },
    }));

    return res.json({ status: 'success', data: { chapter: { id: chapter.id, title: chapter.title, comicId: chapter.comicId }, contributors: result } });
  } catch (error) {
    next(error);
  }
}

// Get contributors for a specific comic (admin / moderator view)
export async function getContributorsByComic(req, res, next) {
  try {
    const { comicId } = req.params;
    const comic = await db.get('SELECT id, name FROM comics WHERE id = ?', [comicId]);
    if (!comic) {
      return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    }

    const contributors = await db.all(
      `SELECT cc.comicId, cc.userId, cc.role, cc.status, cc.unread, cc.createdAt, cc.updatedAt, u.displayName, u.avatar
       FROM comic_contributors cc
       LEFT JOIN users u ON cc.userId = u.id
       WHERE cc.comicId = ?
       ORDER BY cc.updatedAt DESC`,
      [comicId]
    );

    const result = contributors.map((row) => ({
      comicId: row.comicId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      unread: row.unread,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.userId,
        displayName: row.displayName,
        avatar: row.avatar,
      },
    }));

    return res.json({ status: 'success', data: { comic: { id: comic.id, name: comic.name }, contributors: result } });
  } catch (error) {
    next(error);
  }
}
