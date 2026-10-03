import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import * as userModel from '../models/userModel.js';

export async function getProfile(req, res, next) {
  try {
    const user = await userModel.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    const preferences = await userModel.getUserPreferences(req.user.id);
    user.preference = preferences || { theme: 'light', filter: 1 };

    return res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { avatar, background, displayName, username, email, bio, socialLinks } = req.body;
    const user = await userModel.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    const updatedUser = await userModel.updateUser(req.user.id, { avatar, background, displayName, username, email, bio, socialLinks });

    return res.json({ status: 'success', data: updatedUser });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Avatar file is required' });
    }

    const avatarUrl = `avatars/${req.file.filename}`;
    const updatedUser = await userModel.updateUser(req.user.id, { avatar: avatarUrl });

    return res.json({ status: 'success', data: updatedUser });
  } catch (error) {
    next(error);
  }
}

export async function uploadBackground(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Background file is required' });
    }

    const backgroundUrl = `backgrounds/${req.file.filename}`;
    const updatedUser = await userModel.updateUser(req.user.id, { background: backgroundUrl });

    return res.json({ status: 'success', data: updatedUser });
  } catch (error) {
    next(error);
  }
}

export async function updatePassword(req, res, next) {
  try {
    const { newPassword, confirmPassword } = req.body;
    
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ status: 'fail', message: 'New password and confirmation are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ status: 'fail', message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'fail', message: 'Password must be at least 6 characters' });
    }

    const user = await userModel.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    await userModel.updateUserPassword(req.user.id, newPassword);

    return res.json({ status: 'success', message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const { theme, filter } = req.body;
    const updated = await userModel.updateUserPreferences(req.user.id, { theme, filter });
    return res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
}

// router.get('/following
export async function getFollowingList(req, res, next) {
  try {
    const userId = req.user.id;

    // 1. Lấy thông tin cơ bản, tính tổng số chương và chương đọc gần nhất qua Subquery
    const list = await db.all(
      `SELECT 
         f.userId,
         f.updatedAt AS followingUpdatedAt,
         fc.id AS categoryId,
         fc.category AS categoryName,
         c.id AS comicId,
         c.name AS comicName,
         c.url AS comicUrl,
         c.coverUrl AS comicCoverUrl,
         c.description AS comicDescription,
         c.updatedAt AS comicUpdatedAt,
         c.types AS comicTypes,
         c.contentRating AS comicContentRating,
         c.demographic AS comicDemographic,
         c.releaseStatus AS comicReleaseStatus,
         c.releasingYear AS comicReleasingYear,
         c.rating AS comicRating,
         c.view AS comicView,
         c.follow AS comicFollow,
         au.name AS authorName,
         ar.name AS artistName,
         (SELECT rating FROM rating_history WHERE userId = f.userId AND comicId = c.id) AS userRating,
         
         -- Tính tổng số chapter chưa bị xóa soft-delete
         (SELECT COUNT(*) 
          FROM chapters 
          WHERE comicId = c.id AND deletedAt IS NULL) AS totalChapters,
          
         -- Lấy chapterNumber của chương có thời gian đọc (readAt) mới nhất của người dùng
         (SELECT ch.chapterNumber 
          FROM read_history rh 
          JOIN chapters ch ON rh.chapterId = ch.id 
          WHERE ch.comicId = c.id AND rh.userId = f.userId AND ch.deletedAt IS NULL
          ORDER BY rh.readAt DESC 
          LIMIT 1) AS readedChapter

       FROM following f
       JOIN comics c ON f.comicId = c.id
       LEFT JOIN following_categories fc ON f.followingCategoryId = fc.id
       LEFT JOIN author au ON c.authorId = au.id
       LEFT JOIN artist ar ON c.artistId = ar.id
       WHERE f.userId = ?
       ORDER BY c.name`,
      [userId]
    );

    // Nếu người dùng không theo dõi truyện nào, trả về mảng rỗng ngay lập tức
    if (list.length === 0) {
      return res.json({ status: 'success', data: [] });
    }

    const comicIds = list.map((item) => item.comicId);

    // 2. Truy vấn gộp các thuộc tính có quan hệ 1-nhiều (One-to-Many / Many-to-Many)
    const otherNames = await db.all(
      `SELECT comicId, name FROM comic_other_names WHERE comicId IN (${comicIds.map(() => '?').join(',')})`,
      comicIds
    );

    const genresList = await db.all(
      `SELECT cg.comicId, g.name 
       FROM comic_genres cg 
       JOIN genres g ON cg.genreId = g.id 
       WHERE cg.comicId IN (${comicIds.map(() => '?').join(',')})`,
      comicIds
    );

    const formatsList = await db.all(
      `SELECT cf.comicId, f.name 
       FROM comic_formats cf 
       JOIN formats f ON cf.formatId = f.id 
       WHERE cf.comicId IN (${comicIds.map(() => '?').join(',')})`,
      comicIds
    );

    // 3. Khởi tạo các từ điển (Maps) để tra cứu nhanh thông tin
    const otherNamesMap = {};
    const genresMap = {};
    const formatsMap = {};

    comicIds.forEach((id) => {
      otherNamesMap[id] = [];
      genresMap[id] = [];
      formatsMap[id] = [];
    });

    otherNames.forEach((row) => {
      otherNamesMap[row.comicId].push({ name: row.name, country: 'Unknown' });
    });

    genresList.forEach((row) => {
      genresMap[row.comicId].push(row.name);
    });

    formatsList.forEach((row) => {
      formatsMap[row.comicId].push(row.name);
    });

    // 4. Ánh xạ dữ liệu thô sang cấu trúc đối tượng lồng nhau chuẩn của TypeScript Interface FollowingComic
    const responseData = list.map((item) => {
      const comicId = item.comicId;

      return {
        userId: item.userId,
        updatedAt: item.followingUpdatedAt,
        comic: {
          id: comicId,
          name: item.comicName || undefined,
          names: otherNamesMap[comicId] || [],
          url: item.comicUrl,
          coverUrl: item.comicCoverUrl,
          description: item.comicDescription || undefined,
          updatedAt: item.comicUpdatedAt || null,
          types: item.comicTypes || undefined,
          contentRating: item.comicContentRating || undefined,
          demographic: item.comicDemographic || undefined,
          genres: genresMap[comicId] || [],
          tags: [],
          formats: formatsMap[comicId] || [],
          releaseStatus: item.comicReleaseStatus || undefined,
          releasingYear: item.comicReleasingYear ? String(item.comicReleasingYear) : undefined,
          userRating: item.userRating || undefined,
          rating: item.comicRating || 0,
          view: item.comicView || 0,
          follow: item.comicFollow || 0,
          author: item.authorName || undefined,
          artist: item.artistName || undefined,
          latestChapters: [],
        },
        category: {
          id: item.categoryId || '',
          category: item.categoryName || 'Default',
        },
        readedChapter: item.readedChapter !== null ? item.readedChapter : 0, // Trả về 0 nếu chưa từng đọc chương nào
        totalChapters: item.totalChapters || 0,
      };
    });

    return res.json({ status: 'success', data: responseData });
  } catch (error) {
    next(error);
  }
}

//router.get('/following/categories',
export async function getFollowingCategories(req, res, next) {
  try {
    const categories = await db.all(
      `SELECT id, category, userId
       FROM following_categories
       WHERE userId IS NULL OR userId = ?
       ORDER BY CASE WHEN userId IS NULL THEN 0 ELSE 1 END, category`,
      [req.user.id]
    );

    return res.json({ status: 'success', data: categories });
  } catch (error) {
    next(error);
  }
}

// router.post('/following/categories'
export async function createFollowingCategory(req, res, next) {
  try {
    const { category } = req.body;
    const trimmed = String(category || '').trim();

    if (!trimmed) {
      return res.status(400).json({ status: 'fail', message: 'Category name is required' });
    }

    const existing = await db.get(
      `SELECT id FROM following_categories WHERE lower(category) = lower(?) AND (userId IS NULL OR userId = ?)`,
      [trimmed, req.user.id]
    );

    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Category already exists' });
    }

    const id = uuidv4();
    await db.run(`INSERT INTO following_categories (id, category, userId) VALUES (?, ?, ?)`, [id, trimmed, req.user.id]);

    return res.status(201).json({ status: 'success', data: { id, category: trimmed, userId: req.user.id } });
  } catch (error) {
    next(error);
  }
}

// router.put('/following/categories/:categoryId'
export async function updateFollowingCategory(req, res, next) {
  try {
    const { categoryId } = req.params;
    const { category } = req.body;
    const trimmed = String(category || '').trim();

    if (!trimmed) {
      return res.status(400).json({ status: 'fail', message: 'Category name is required' });
    }

    const existing = await db.get('SELECT id FROM following_categories WHERE id = ? AND (userId IS NULL OR userId = ?)', [categoryId, req.user.id]);
    if (!existing) {
      return res.status(404).json({ status: 'fail', message: 'Category not found' });
    }

    await db.run(`UPDATE following_categories SET category = ? WHERE id = ?`, [trimmed, categoryId]);
    return res.json({ status: 'success', data: { id: categoryId, category: trimmed } });
  } catch (error) {
    next(error);
  }
}

export async function deleteFollowingCategory(req, res, next) {
  try {
    const { categoryId } = req.params;
    const category = await db.get('SELECT id FROM following_categories WHERE id = ? AND userId = ?', [categoryId, req.user.id]);
    if (!category) {
      return res.status(404).json({ status: 'fail', message: 'Category not found' });
    }

    await db.run(`UPDATE following SET followingCategoryId = NULL WHERE followingCategoryId = ? AND userId = ?`, [categoryId, req.user.id]);
    await db.run(`DELETE FROM following_categories WHERE id = ? AND userId = ?`, [categoryId, req.user.id]);

    return res.json({ status: 'success', message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateFollowingComicCategory(req, res, next) {
  try {
    const { comicId } = req.params;
    const { categoryId } = req.body || {};

    if (categoryId) {
      const category = await db.get('SELECT id FROM following_categories WHERE id = ? AND (userId IS NULL OR userId = ?)', [categoryId, req.user.id]);
      if (!category) {
        return res.status(404).json({ status: 'fail', message: 'Category not found' });
      }
    }

    const existing = await db.get('SELECT id FROM following WHERE userId = ? AND comicId = ?', [req.user.id, comicId]);
    if (!existing) {
      return res.status(404).json({ status: 'fail', message: 'Following entry not found' });
    }

    await db.run(`UPDATE following SET followingCategoryId = ? WHERE userId = ? AND comicId = ?`, [categoryId || null, req.user.id, comicId]);
    return res.json({ status: 'success', data: { comicId, followingCategoryId: categoryId || null } });
  } catch (error) {
    next(error);
  }
}

export async function getBookmarks(req, res, next) {
  try {
    const list = await db.all(
      `SELECT c.id, c.name, c.url
       FROM bookmarks b
       JOIN comics c ON b.comicId = c.id
       WHERE b.userId = ?`,
      [req.user.id]
    );
    return res.json({ status: 'success', data: list });
  } catch (error) {
    next(error);
  }
}

export async function getReadingHistory(req, res, next) {
  try {
    const history = await db.all(
      `SELECT rh.chapterId,
              rh.scrollPosition,
              rh.currentPage,
              rh.readAt,
              c.name AS comicName,
              c.url AS comicUrl,
              c.coverUrl AS coverUrl,
              ch.title AS chapterTitle,
              ch.url AS chapterUrl,
              ch.chapterNumber AS chapterNumber,
              (SELECT COUNT(*) FROM chapter_images WHERE chapterId = ch.id) AS totalPage
       FROM read_history rh
       JOIN chapters ch ON rh.chapterId = ch.id
       JOIN comics c ON ch.comicId = c.id
       WHERE rh.userId = ?
       ORDER BY rh.readAt DESC`,
      [req.user.id]
    );
    return res.json({ status: 'success', data: history });
  } catch (error) {
    next(error);
  }
}

export async function removeHistoryChapter(req, res, next) {
  try {
    const { chapterId } = req.params;
    await db.run(`DELETE FROM read_history WHERE userId = ? AND chapterId = ?`, [req.user.id, chapterId]);
    return res.json({ status: 'success', message: 'Successfully removed chapter from reading history' });
  } catch (error) {
    next(error);
  }
}

export async function clearReadingHistory(req, res, next) {
  try {
    await db.run(`DELETE FROM read_history WHERE userId = ?`, [req.user.id]);
    return res.json({ status: 'success', message: 'Successfully cleared all reading history' });
  } catch (error) {
    next(error);
  }
}
