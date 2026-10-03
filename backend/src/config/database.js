// database.js

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = path.join(dataDir, 'comic-platform.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
});

// Ensure the background column exists for older database versions
try {
  await db.exec(`ALTER TABLE users ADD COLUMN background TEXT;`);
} catch (error) {
  // Ignore errors if the column already exists or the table does not exist yet.
}

// 1. Tạo các bảng cấu trúc cơ sở dữ liệu trước để đảm bảo chúng luôn tồn tại
await db.exec(`
  -- 1. Table User
  CREATE TABLE IF NOT EXISTS users (
    id TEXT NOT NULL PRIMARY KEY,
    avatar TEXT,
    background TEXT,
    displayName TEXT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    bio TEXT,
    socialLinks TEXT,
    role TEXT DEFAULT 'user', -- 'user', 'contributor', 'moderator', 'admin'
    isBanned INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Table UserPreference
  CREATE TABLE IF NOT EXISTS user_preferences (
    userId TEXT NOT NULL PRIMARY KEY,
    theme TEXT DEFAULT 'light',
    filter INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 3. Bảng danh mục chuẩn hóa (Normalization)
  CREATE TABLE IF NOT EXISTS author (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS artist (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS genres (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS formats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
  );

  -- 4. Table Comic (Đã tối ưu)
  CREATE TABLE IF NOT EXISTS comics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT,
    types TEXT NOT NULL, -- manga, manhwa, manhua, other
    status TEXT DEFAULT 'pending',
    contentRating TEXT NOT NULL, -- safe, suggestive, erotica, pornographic
    demographic TEXT NOT NULL, -- josei, seinen, shoujo, shounen
    description TEXT,
    rating REAL DEFAULT 0,
    coverUrl TEXT,
    view INTEGER DEFAULT 0,
    follow INTEGER DEFAULT 0,
    releaseStatus TEXT NOT NULL, -- releasing, finished, on hiatus, discontinued
    visibility TEXT DEFAULT 'public', -- public, hidden, private
    deletedAt TEXT DEFAULT NULL, -- Soft delete
    url TEXT NOT NULL UNIQUE,
    releasingYear INTEGER,
    authorId TEXT,
    artistId TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(artistId) REFERENCES artist(id),
    FOREIGN KEY(authorId) REFERENCES author(id)
  );

  -- 5. Bảng trung gian (Many-to-Many) cho Comic
  CREATE TABLE IF NOT EXISTS comic_genres (
    comicId TEXT NOT NULL,
    genreId TEXT NOT NULL,
    PRIMARY KEY(comicId, genreId),
    FOREIGN KEY(comicId) REFERENCES comics(id),
    FOREIGN KEY(genreId) REFERENCES genres(id)
  );

  CREATE TABLE IF NOT EXISTS comic_formats (
    comicId TEXT NOT NULL,
    formatId TEXT NOT NULL,
    PRIMARY KEY(comicId, formatId),
    FOREIGN KEY(comicId) REFERENCES comics(id),
    FOREIGN KEY(formatId) REFERENCES formats(id)
  );

  CREATE TABLE IF NOT EXISTS comic_other_names (
    id TEXT PRIMARY KEY,
    comicId TEXT NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    FOREIGN KEY(comicId) REFERENCES comics(id)
  );

  CREATE TABLE IF NOT EXISTS comic_contributors (
    comicId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT DEFAULT 'uploader', -- owner, translator, editor
    status TEXT DEFAULT 'pending', -- pending, accept, reject
    unread INTEGER DEFAULT 1, -- 0 = đã đọc, 1 = chưa đọc
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(comicId, userId),
    FOREIGN KEY(comicId) REFERENCES comics(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 6. Table Chapter
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    comicId TEXT NOT NULL,
    title TEXT NOT NULL,
    chapterNumber REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    visibility TEXT DEFAULT 'public',
    deletedAt TEXT DEFAULT NULL,
    url TEXT NOT NULL UNIQUE,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(comicId) REFERENCES comics(id)
  );

  -- 7. Table ChapterImage
  CREATE TABLE IF NOT EXISTS chapter_images (
    id TEXT PRIMARY KEY,
    chapterId TEXT NOT NULL,
    urlPath TEXT NOT NULL,
    pageNumber INTEGER NOT NULL,
    FOREIGN KEY(chapterId) REFERENCES chapters(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_contributors (
    chapterId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT DEFAULT 'contributor',
    status TEXT DEFAULT 'pending', -- pending, accept, reject
    unread INTEGER DEFAULT 1, -- 0 = đã đọc, 1 = chưa đọc
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(chapterId, userId),
    FOREIGN KEY(chapterId) REFERENCES chapters(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 8. Table Interactions (History, Bookmark, Following)
  CREATE TABLE IF NOT EXISTS read_history (
    userId TEXT NOT NULL,
    chapterId TEXT NOT NULL,
    readAt TEXT DEFAULT CURRENT_TIMESTAMP,
    currentPage INTEGER DEFAULT 1,
    PRIMARY KEY(userId, chapterId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(chapterId) REFERENCES chapters(id)
  );

  CREATE TABLE IF NOT EXISTS rating_history (
    userId TEXT NOT NULL,
    comicId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(userId, comicId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(comicId) REFERENCES comics(id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    userId TEXT NOT NULL,
    comicId TEXT NOT NULL,
    followingCategoryId TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(userId, comicId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(comicId) REFERENCES comics(id),
    FOREIGN KEY(followingCategoryId) REFERENCES following_categories(id)
  );

  CREATE TABLE IF NOT EXISTS following_categories (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    userId TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS following (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    comicId TEXT NOT NULL,
    followingCategoryId TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(comicId) REFERENCES comics(id),
    FOREIGN KEY(followingCategoryId) REFERENCES following_categories(id)
  );

  -- 9. Table Comments & Reactions
  CREATE TABLE IF NOT EXISTS comic_comments (
    id TEXT PRIMARY KEY,
    comicId TEXT NOT NULL,
    userId TEXT NOT NULL,
    content TEXT NOT NULL,
    parentCommentId TEXT,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    isBanned INTEGER DEFAULT 0,
    deletedAt TEXT DEFAULT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(comicId) REFERENCES comics(id),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(parentCommentId) REFERENCES comic_comments(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_comments (
    id TEXT PRIMARY KEY,
    chapterId TEXT NOT NULL,
    userId TEXT NOT NULL,
    content TEXT NOT NULL,
    parentCommentId TEXT,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    isBanned INTEGER DEFAULT 0,
    deletedAt TEXT DEFAULT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(chapterId) REFERENCES chapters(id),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(parentCommentId) REFERENCES chapter_comments(id)
  );

  CREATE TABLE IF NOT EXISTS comic_comment_reactions (
    userId TEXT NOT NULL,
    commentId TEXT NOT NULL,
    reactionType TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(userId, commentId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(commentId) REFERENCES comic_comments(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_comment_reactions (
    userId TEXT NOT NULL,
    commentId TEXT NOT NULL,
    reactionType TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(userId, commentId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(commentId) REFERENCES chapter_comments(id)
  );

  -- 10. Table Moderation & Edit Requests
  CREATE TABLE IF NOT EXISTS edit_requests (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    targetType TEXT NOT NULL, -- comic, chapter, author, artist
    targetId TEXT NOT NULL,
    proposedChanges TEXT NOT NULL, -- Chuỗi JSON chứa dữ liệu đề xuất thay đổi
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    moderatorId TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(moderatorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS moderation_logs (
    id TEXT PRIMARY KEY,
    moderatorId TEXT NOT NULL,
    action TEXT NOT NULL, -- approve, reject, hide, delete
    targetType TEXT NOT NULL, -- comic, chapter, comment, edit_request
    targetId TEXT NOT NULL,
    reason TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(moderatorId) REFERENCES users(id)
  );

  -- 11. Table System (Notifications, Sessions)
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    redirectPath TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    expiresAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 12. Indexes để tối ưu hiệu suất truy vấn
  CREATE INDEX IF NOT EXISTS idx_comic_comments_parent ON comic_comments(parentCommentId);
  CREATE INDEX IF NOT EXISTS idx_comic_comments_comic_parent ON comic_comments(comicId, parentCommentId);
  
  CREATE INDEX IF NOT EXISTS idx_chapter_comments_parent ON chapter_comments(parentCommentId);
  CREATE INDEX IF NOT EXISTS idx_chapter_comments_chap_parent ON chapter_comments(chapterId, parentCommentId);

  CREATE INDEX IF NOT EXISTS idx_following_categories_user ON following_categories(userId);
  CREATE INDEX IF NOT EXISTS idx_following_category ON following(followingCategoryId);
  
  CREATE INDEX IF NOT EXISTS idx_comic_genres_comic ON comic_genres(comicId);
  CREATE INDEX IF NOT EXISTS idx_comic_formats_comic ON comic_formats(comicId);
  CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON edit_requests(status);
`);

// 2. Chạy cơ chế di dời (migration) bổ sung cột nếu cơ sở dữ liệu cũ chưa có các cột này
async function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

await ensureColumn('bookmarks', 'followingCategoryId', 'TEXT');
await ensureColumn('following', 'followingCategoryId', 'TEXT');
await ensureColumn('read_history', 'currentPage', 'INTEGER DEFAULT 1');
await ensureColumn('comics', 'source', 'TEXT');
await ensureColumn('users', 'isBanned', 'INTEGER DEFAULT 0');
await ensureColumn('comic_comments', 'isBanned', 'INTEGER DEFAULT 0');
await ensureColumn('chapter_comments', 'isBanned', 'INTEGER DEFAULT 0');
await ensureColumn('comics', 'status', 'TEXT DEFAULT \"pending\"');
await ensureColumn('chapters', 'status', 'TEXT DEFAULT \"pending\"');

export default db;