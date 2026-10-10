# Backend security & bug-fix changes (Phase 1 + Phase 2)

Date: 2026-10-03
Scope: `backend/` (plus a small matching change in the frontend password form)

This document lists every change made, with the **old code**, the **new code**, and **why** it changed.
Phase 3 (folder restructure, `.gitignore` cleanup, merging comment controllers, `/api`-only routes) was **not** done.

---

## Summary

| # | Area | Severity | File(s) |
|---|------|----------|---------|
| 1 | Anyone could approve/reject comics (self-approval) | 🔴 Critical | `routes/comicRoutes.js` |
| 2 | Passwords stored in plain text | 🔴 Critical | `models/userModel.js`, `scripts/seed.js` |
| 3 | Contributors could edit any comic | 🔴 Critical | `controllers/comicController.js` |
| 4 | Password change didn't need the current password | 🔴 Critical | `controllers/userController.js`, frontend |
| 5 | Bans were never enforced | 🔴 Critical | `controllers/authController.js`, `helpers/dbhelper.js` |
| 6 | Unrestricted file uploads (stored XSS) | 🔴 Critical | `middlewares/uploadMiddleware.js` |
| 7 | Admin could assign any string as a role / ban self | 🔴 Critical | `controllers/adminController.js` |
| 8 | CORS open to every site, no security headers, no rate limit | 🟠 Medium | `server.js` |
| 9 | Error handler leaked SQL/internal errors | 🟠 Medium | `middlewares/errorMiddleware.js` |
| 10 | No input validation on register | 🟠 Medium | `controllers/authController.js` |
| 11 | Users could rename shared default categories | 🟠 Medium | `controllers/userController.js` |
| 12 | Hidden/deleted chapters readable by ID | 🟠 Medium | `controllers/comicController.js` |
| 13 | `GET /comics` and `/comics/popular` crashed without filter | 🟡 Bug | `controllers/comicController.js` |
| 14 | `contry` typo, missing `status` in comic detail | 🟡 Bug | `controllers/comicController.js` |
| 15 | `scrollPosition` missing from schema (fresh DB broke reading) | 🟡 Bug | `config/database.js` |
| 16 | Foreign keys not enforced | 🟡 Bug | `config/database.js` (+ fixes it exposed) |
| 17 | No transactions for multi-step writes | 🟡 Bug | `config/database.js`, controllers |
| 18 | Rejected uploads left orphan files on disk | 🟡 Bug | `middlewares/uploadMiddleware.js`, `server.js` |
| 19 | `/chapters/...` contributor endpoints unreachable from frontend | 🟡 Bug | `server.js`, `routes/comicRoutes.js` |
| 20 | Duplicate username on profile update returned 500 | 🟡 Bug | `controllers/userController.js` |

New dependencies: `bcryptjs`, `helmet`, `express-rate-limit`.

---

## 🔴 1. Self-approval of comics (missing role check)

**File:** `src/routes/comicRoutes.js`

**Reason:** These routes only checked that the user was *logged in*. Any user could call
`PUT /comics/:comicId/contributors/:userId` with `{ "status": "accept" }` and approve their own
upload, which skipped moderation completely. The `:chapterId` routes in the same file could never run,
because Express matched `/:comicId/contributors` first. The working chapter versions already live in
`chaptersRoutes.js` (with a role check).

**Old:**
```js
// Contributor routes
router.get('/:comicId/contributors', authenticateToken, getContributorsByComic);
router.put('/:comicId/contributors/:userId', authenticateToken, updateComicContributorStatus);
router.patch('/:comicId/contributors/:userId/read', authenticateToken, markComicContributorRead);

router.get('/:chapterId/contributors', authenticateToken, (req, res, next) => {
  // This would be for admins to view contributors - TODO
  res.status(501).json({ status: 'fail', message: 'Not implemented' });
});
router.put('/:chapterId/contributors/:userId', authenticateToken, updateChapterContributorStatus);
router.patch('/:chapterId/contributors/:userId/read', authenticateToken, markChapterContributorRead);
```

**New:**
```js
// Contributor routes (moderation) — chapter equivalents live in chaptersRoutes.js
router.get('/:comicId/contributors', authenticateToken, requireRole('admin', 'moderator'), getContributorsByComic);
router.put('/:comicId/contributors/:userId', authenticateToken, requireRole('admin', 'moderator'), updateComicContributorStatus);
router.patch('/:comicId/contributors/:userId/read', authenticateToken, markComicContributorRead);
```

---

## 🔴 2. Plain-text passwords → bcrypt

**Files:** `src/models/userModel.js`, `scripts/seed.js`

**Reason:** Passwords were saved and compared as plain text (`WHERE ... AND password = ?`).
Anyone who got the `.sqlite` file (it is committed to git) could read every password. Passwords are now
hashed with bcrypt.

**Migration with no downtime:** existing plain-text rows keep working. The first time a user logs in
successfully, their password is re-hashed automatically. No script or reset is needed.

**Old:**
```js
export async function findUserByCredentials(usernameOrEmail, password) {
  return await db.get(
    'SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?',
    [usernameOrEmail, usernameOrEmail, password]
  );
}

export async function createUser(username, password, email, displayName) {
  const id = uuidv4();
  await db.run(
    `INSERT INTO users (id, username, password, email, displayName, role) VALUES (?, ?, ?, ?, ?, 'user')`,
    [id, username, password, email, displayName]
  );
  ...
}

export async function updateUserPassword(id, password) {
  await db.run(`UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [password, id]);
}
```

**New:**
```js
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Accepts legacy plain-text rows and upgrades them to a bcrypt hash on the first successful check.
export async function verifyUserPassword(user, password) {
  if (!user?.password || typeof password !== 'string') return false;

  if (isBcryptHash(user.password)) {
    return bcrypt.compare(password, user.password);
  }

  if (user.password !== password) return false;
  await db.run('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(password), user.id]);
  return true;
}

export async function findUserByCredentials(usernameOrEmail, password) {
  const user = await db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [usernameOrEmail, usernameOrEmail]
  );
  return (await verifyUserPassword(user, password)) ? user : null;
}

export async function createUser(username, password, email, displayName) {
  const id = uuidv4();
  const passwordHash = await hashPassword(password);
  await db.run(
    `INSERT INTO users (id, username, password, email, displayName, role) VALUES (?, ?, ?, ?, ?, 'user')`,
    [id, username, passwordHash, email, displayName]
  );
  ...
}

export async function updateUserPassword(id, password) {
  await db.run(
    `UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [await hashPassword(password), id]
  );
}
```

`scripts/seed.js`:
```diff
+ import { hashPassword } from '../src/models/userModel.js';
  ...
- [userId, user.displayName, user.username, user.password, user.email, user.bio, user.role]
+ [userId, user.displayName, user.username, await hashPassword(user.password), user.email, user.bio, user.role]
```

---

## 🔴 3. Contributors could edit any comic

**File:** `src/controllers/comicController.js` → `updateComic`

**Reason:** Any user with the `contributor` role could `PATCH /comics/:comicId` for *any* comic and
overwrite its name, cover, URL and genres. Now only the comic's own contributors, or moderators and
admins, can edit it.

**Old:**
```js
const existingComic = await db.get('SELECT id, url, coverUrl FROM comics WHERE id = ?', [comicId]);
if (!existingComic) {
  return res.status(404).json({ status: 'fail', message: 'Comic not found' });
}

if (!name || !types || !demographic || !url) {
```

**New:**
```js
function isStaffUser(user) {
  return user?.role === 'admin' || user?.role === 'moderator';
}

// Staff can manage any comic; everyone else only comics they are a contributor of.
async function canManageComic(user, comicId) {
  if (isStaffUser(user)) return true;
  const row = await db.get('SELECT 1 FROM comic_contributors WHERE comicId = ? AND userId = ?', [comicId, user.id]);
  return Boolean(row);
}

// in updateComic:
const existingComic = await db.get('SELECT id, url, coverUrl FROM comics WHERE id = ?', [comicId]);
if (!existingComic) {
  return res.status(404).json({ status: 'fail', message: 'Comic not found' });
}

if (!(await canManageComic(req.user, comicId))) {
  return res.status(403).json({ status: 'fail', message: 'You can only edit comics you contribute to' });
}
```

> **Design note: `createChapter` is intentionally still open to any contributor.** The upload UI
> (`UploadedChaptersPanel`) lets a contributor enter *any* comic URL and upload a chapter to it, and
> every chapter still goes through moderation. Two small guards were added: the comic must not be
> soft-deleted, and `chapterNumber` must be a non-negative number.

---

## 🔴 4. Password change without the current password

**Files:** `src/controllers/userController.js` → `updatePassword`, `src/models/userModel.js`,
frontend `services/api.ts` + `EditProfilePanel.tsx`

**Reason:** Anyone with a stolen session token (or access to an unlocked computer) could change the
password and lock the real owner out. Old sessions also stayed valid after a change. Now:
- the current password is required and checked
- all *other* sessions are logged out after a change (the current one stays)
- the new password must be 6–72 characters (bcrypt ignores anything past 72 bytes)

**Old:**
```js
const { newPassword, confirmPassword } = req.body;

if (!newPassword || !confirmPassword) { ... }
if (newPassword !== confirmPassword) { ... }
if (newPassword.length < 6) { ... }

const user = await userModel.findUserById(req.user.id);
if (!user) { ... }

await userModel.updateUserPassword(req.user.id, newPassword);
```

**New:**
```js
const { currentPassword, newPassword, confirmPassword } = req.body;

if (!currentPassword || !newPassword || !confirmPassword) {
  return res.status(400).json({ status: 'fail', message: 'Current password, new password and confirmation are required' });
}
if (newPassword !== confirmPassword) { ... }
if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) { ... }

const user = await userModel.findUserPasswordById(req.user.id);
if (!user) { ... }

if (!(await userModel.verifyUserPassword(user, currentPassword))) {
  return res.status(401).json({ status: 'fail', message: 'Current password is incorrect' });
}

await userModel.updateUserPassword(req.user.id, newPassword);
await userModel.deleteOtherSessions(req.user.id, req.session.token);
```

New model helpers:
```js
export async function findUserPasswordById(id) {
  return await db.get('SELECT id, password FROM users WHERE id = ?', [id]);
}

export async function deleteOtherSessions(userId, keepToken) {
  await db.run('DELETE FROM sessions WHERE userId = ? AND token != ?', [userId, keepToken]);
}
```

**Frontend (required for the form to keep working):**
```diff
- updatePassword: (newPassword: string, confirmPassword: string) =>
+ updatePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<{ message: string }>('/user/password-reset', {
      ...
-     body: JSON.stringify({ newPassword, confirmPassword }),
+     body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
```
`EditProfilePanel.tsx` now has a **Current password** field, sends it, and shows an error if a new
password is entered without it.

---

## 🔴 5. Bans were never enforced

**Files:** `src/controllers/authController.js`, `src/helpers/dbhelper.js`

**Reason:** Admins could set `users.isBanned = 1`, but nothing ever read it. Banned users could still
log in and keep using their existing sessions.

**Old (`login`):**
```js
const user = await userModel.findUserByCredentials(userName, password);
if (!user) {
  return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
}

const token = uuidv4();
```

**New (`login`):**
```js
const user = await userModel.findUserByCredentials(userName, password);
if (!user) {
  return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
}

if (user.isBanned) {
  return res.status(403).json({ status: 'fail', message: 'This account has been banned' });
}

const token = uuidv4();
```

**Old (`getValidSession`):**
```sql
WHERE s.token = ?
```

**New (`getValidSession`)** – a ban now takes effect on the user's very next request:
```sql
WHERE s.token = ? AND COALESCE(u.isBanned, 0) = 0
```

---

## 🔴 6. Unrestricted file uploads

**File:** `src/middlewares/uploadMiddleware.js`

**Reason:**
- Any file type was accepted, and the **client's own extension** was kept. Someone could upload
  `evil.html` or `evil.svg` containing JavaScript. It would then be served from
  `http://localhost:5000/storage/...`, which is the API's own origin (**stored XSS**).
- There was no size or count limit, so someone could fill the disk.
- Filenames used `Math.random()`, which isn't designed to be unpredictable.
- The storage path depended on `process.cwd()`, so starting the server from another folder wrote files
  to the wrong place.

**Old:**
```js
const storageRoot = path.join(process.cwd(), 'storage');
...
filename(req, file, cb) {
  const ext = path.extname(file.originalname) || '.png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  cb(null, fileName);
},
...
const upload = multer({ storage });
```

**New:**
```js
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// SVG is intentionally excluded: it can carry scripts and is served from our own origin.
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const storageRoot = path.join(__dirname, '..', '..', 'storage');
...
filename(req, file, cb) {
  // Extension comes from the validated MIME type, never from the client-supplied filename.
  cb(null, `${randomUUID()}${ALLOWED_IMAGE_TYPES[file.mimetype]}`);
},
...
function fileFilter(req, file, cb) {
  if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
    const error = new Error('Only JPEG, PNG, WEBP or GIF images are allowed');
    error.status = 400;
    return cb(error);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per image
    files: 100,
  },
});
```

Even if a client sends a fake MIME type, the saved file always has an image extension. It is served
with an image `Content-Type`, and `X-Content-Type-Options: nosniff` (from helmet, see #8) stops the
browser from treating it as anything else.

---

## 🔴 7. Role assignment accepted any value; admins could lock themselves out

**File:** `src/controllers/adminController.js`

**Reason:** `assignUserRole` stored whatever string it was sent (e.g. `"superadmin"`, `""`, `"Admin"`),
which leaves broken rows in the DB. An admin could also demote or ban *themselves* by mistake and lose
access.

**Old:**
```js
const { role } = req.body;
if (!role) {
  return res.status(400).json({ status: 'fail', message: 'Role is required' });
}
```

**New:**
```js
const VALID_ROLES = ['user', 'contributor', 'moderator', 'admin'];
...
if (!VALID_ROLES.includes(role)) {
  return res.status(400).json({ status: 'fail', message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
}

if (userId === req.user.id) {
  return res.status(400).json({ status: 'fail', message: 'You cannot change your own role' });
}
```

`toggleUserBan` also gained:
```js
if (userId === req.user.id) {
  return res.status(400).json({ status: 'fail', message: 'You cannot ban yourself' });
}
```

---

## 🟠 8. CORS, security headers, rate limiting, body limits

**File:** `src/server.js`

**Reason:**
- `cors()` with no options lets **every website** call the API from a visitor's browser.
- There were no security headers (`nosniff`, `X-Frame-Options`, etc.), and `X-Powered-By: Express`
  told everyone which framework the server uses.
- Nothing stopped someone from trying thousands of passwords against `/auth/login`.
- The static `/storage` path depended on the working directory, like the upload path in #6.

**Old:**
```js
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/storage', express.static('storage'));
...
app.use('/auth', authRoutes);
...
app.use('/api/auth', authRoutes);
```

**New:**
```js
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { storageRoot, cleanupUploadsOnFailure } from './middlewares/uploadMiddleware.js';

// Comma-separated list, e.g. CLIENT_ORIGIN=https://comic.example.com,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Login/register brute-force protection: 20 attempts per IP per 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => !['/login', '/register'].includes(req.path),
  message: { status: 'fail', message: 'Too many attempts, please try again later' },
});

const app = express();
app.disable('x-powered-by');
// Images in /storage are loaded by the frontend from another origin, so allow cross-origin resource loading.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/storage', express.static(storageRoot, { dotfiles: 'deny' }));
app.use(cleanupUploadsOnFailure);
...
app.use('/auth', authLimiter, authRoutes);
...
app.use('/api/auth', authLimiter, authRoutes);
```

> **Deploying:** set `CLIENT_ORIGIN` to your real frontend URL. The default only allows the Vite
> dev server (`localhost:5173`).
>
> The JSON body limit went **up** from Express's default of 100 KB to 1 MB, because
> `EditProfilePanel` sends the cropped avatar as a base64 data URL inside the JSON body.

---

## 🟠 9. Error handler leaked internal errors

**File:** `src/middlewares/errorMiddleware.js`

**Reason:** Every error's `message` went straight to the client, including SQLite messages like
`SQLITE_ERROR: no such column: ...`. Those reveal the table structure to attackers. Upload errors also
came back as 500 instead of 400.

**Old:**
```js
export default function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ status: 'fail', message });
}
```

**New:**
```js
import multer from 'multer';

export default function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ status: 'fail', message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  // Never leak internal details (SQL errors, stack messages) to clients on server errors.
  const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';
  res.status(status).json({ status: 'fail', message });
}
```

---

## 🟠 10. Register input validation

**File:** `src/controllers/authController.js`

**Reason:** `register` only checked that the fields weren't empty. People could register usernames
containing spaces or HTML, invalid emails, 1-character passwords, or 10 MB display names.

**Old:**
```js
const { userName, password, email, displayName } = req.body;
if (!userName || !password || !email || !displayName) {
  return res.status(400).json({ status: 'fail', message: 'Missing required fields' });
}
```

**New:**
```js
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72; // bcrypt ignores bytes beyond 72
...
if (!userName || !password || !email || !displayName) { ... }

if (typeof userName !== 'string' || !USERNAME_PATTERN.test(userName)) {
  return res.status(400).json({ status: 'fail', message: 'Username must be 3-32 characters: letters, numbers, _ . -' });
}
if (typeof email !== 'string' || !EMAIL_PATTERN.test(email) || email.length > 254) {
  return res.status(400).json({ status: 'fail', message: 'Invalid email address' });
}
if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
  return res.status(400).json({ status: 'fail', message: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters` });
}
if (typeof displayName !== 'string' || !displayName.trim() || displayName.length > 50) {
  return res.status(400).json({ status: 'fail', message: 'Display name must be 1-50 characters' });
}
```

---

## 🟠 11. Users could rename shared default categories

**File:** `src/controllers/userController.js` → `updateFollowingCategory`

**Reason:** Categories with `userId IS NULL` are shared defaults that every user sees. The ownership
check allowed `userId IS NULL`, so any user could rename a default category for **everyone**.

**Old:**
```js
const existing = await db.get('SELECT id FROM following_categories WHERE id = ? AND (userId IS NULL OR userId = ?)', [categoryId, req.user.id]);
...
await db.run(`UPDATE following_categories SET category = ? WHERE id = ?`, [trimmed, categoryId]);
```

**New:**
```js
// Shared default categories (userId IS NULL) are read-only for regular users.
const existing = await db.get('SELECT id FROM following_categories WHERE id = ? AND userId = ?', [categoryId, req.user.id]);
...
await db.run(`UPDATE following_categories SET category = ? WHERE id = ? AND userId = ?`, [trimmed, categoryId, req.user.id]);
```

---

## 🟠 12. Hidden / deleted chapters were readable by ID

**File:** `src/controllers/comicController.js` → `getChapterDetail`

**Reason:** When an admin set a chapter (or its comic) to `hidden`, it disappeared from lists but was
still fully readable at `/comics/chapters/:id`. Now guests and regular users get 404 for hidden or
soft-deleted chapters, and for chapters of hidden comics. Admins and moderators can still open them.

**Old:**
```js
const chapter = await db.get(`SELECT id, chapterNumber, title FROM chapters WHERE id = ?`, [chapterId]);
...
const metadata = req.user ? await db.get(`SELECT currentPage FROM read_history WHERE userId = ? AND chapterId = ?`, [req.user.id, chapter.id]) : {};
```

**New:**
```js
const isStaff = isStaffUser(req.user);
const chapter = await db.get(
  `SELECT ch.id, ch.chapterNumber, ch.title
   FROM chapters ch
   JOIN comics c ON ch.comicId = c.id
   WHERE ch.id = ?
     AND (? OR (ch.visibility = 'public' AND ch.deletedAt IS NULL AND c.visibility = 'public' AND c.deletedAt IS NULL))`,
  [chapterId, isStaff ? 1 : 0]
);
...
const metadata = (req.user && await db.get(`SELECT currentPage FROM read_history WHERE userId = ? AND chapterId = ?`, [req.user.id, chapter.id])) || {};
```
(The `metadata` change also prevents a crash, `Cannot set properties of undefined`, if the
history row is ever missing.)

---

## 🟡 13. `GET /comics` and `/comics/popular` crashed without a filter

**File:** `src/controllers/comicController.js` → `listComics`, `popularComics`

**Reason:** With no `contentRating` filter, `whereClause` was an empty string, so the query became
`... FROM comics AND visibility = 'public'`. That is invalid SQL and returned a 500. The count query
also ignored `visibility`, so `totalPages` was wrong, and `?page=abc` produced `OFFSET NaN`.

**Old (`listComics`):**
```js
const offset = (Number(page) - 1) * limit;
const filters = [];
...
const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
...
  FROM comics
  ${whereClause} AND visibility = 'public'
...
  page: Number(page),
```

**New (`listComics`):**
```js
const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
const offset = (currentPage - 1) * limit;
const filters = ["visibility = 'public'"];
...
const whereClause = `WHERE ${filters.join(" AND ")}`;
...
  FROM comics
  ${whereClause}
...
  page: currentPage,
```
The count query reuses `whereClause`, so it now counts only public comics.

**Old (`popularComics`):**
```js
const whereClause = contentRatingClause ? `WHERE ${contentRatingClause}` : '';
...
`SELECT * FROM comics ${whereClause} AND visibility = 'public' ORDER BY view DESC LIMIT 10`,
```

**New (`popularComics`):**
```js
const whereClause = contentRatingClause
  ? `WHERE visibility = 'public' AND ${contentRatingClause}`
  : `WHERE visibility = 'public'`;
...
`SELECT * FROM comics ${whereClause} ORDER BY view DESC LIMIT 10`,
```

---

## 🟡 14. Comic detail: `contry` typo and missing `status`

**File:** `src/controllers/comicController.js` → `getComicDetail`

**Reason:** The column is `country`, so `item.contry` was always `undefined`. The response also
included `status: comic.status`, but `status` was never selected, so it was always `undefined` too.

**Old:**
```js
c.source, a.name AS authorName, ar.name AS artistName
...
country: item.contry // Ánh xạ từ 'contry' sang 'country'
```

**New:**
```js
c.source, c.status, a.name AS authorName, ar.name AS artistName
...
country: item.country
```

---

## 🟡 15. `scrollPosition` missing from the schema

**File:** `src/config/database.js`

**Reason:** `getChapterDetail` and `getReadingHistory` use `read_history.scrollPosition`. Your current
DB has that column (it was added by hand at some point), but `CREATE TABLE` didn't include it. On a
**fresh database**, every logged-in user opening a chapter would get a 500.

**Old:**
```sql
CREATE TABLE IF NOT EXISTS read_history (
  ...
  currentPage INTEGER DEFAULT 1,
  PRIMARY KEY(userId, chapterId),
```

**New:**
```sql
CREATE TABLE IF NOT EXISTS read_history (
  ...
  currentPage INTEGER DEFAULT 1,
  scrollPosition INTEGER DEFAULT 0,
  PRIMARY KEY(userId, chapterId),
```
plus a migration for databases that already exist:
```js
await ensureColumn('read_history', 'scrollPosition', 'INTEGER DEFAULT 0');
```

---

## 🟡 16. Foreign keys were not enforced

**File:** `src/config/database.js` (+ fixes in `adminController.js`, `userController.js`, `seed.js`)

**Reason:** SQLite ignores every `FOREIGN KEY` declaration unless `PRAGMA foreign_keys = ON` is set on
the connection. The schema had foreign keys, but they did nothing, so orphan rows could be created
(e.g. a comment on a comic that doesn't exist).

**New:**
```js
// SQLite ignores FOREIGN KEY constraints unless this is enabled per connection.
await db.exec('PRAGMA foreign_keys = ON;');
```

Turning foreign keys on exposed three places that would have started failing. All three are fixed:

**a) Admin force-delete of comments** (`forceDeleteComicComment` / `forceDeleteChapterComment`). A hard
delete would fail if the comment had replies or reactions. It now uses the same soft delete as
deleting your own comment:
```diff
- await db.run('DELETE FROM comic_comments WHERE id = ?', [commentId]);
+ // Soft delete (same as user deletion) so replies and reactions keep a valid parent row.
+ await db.run(`UPDATE comic_comments SET content = '', deletedAt = CURRENT_TIMESTAMP WHERE id = ?`, [commentId]);
```
(Same change for `chapter_comments`.)

**b) Deleting a following category** that a bookmark still referenced. `bookmarks` is now cleared
too, and the three statements run in one transaction:
```diff
- await db.run(`UPDATE following SET followingCategoryId = NULL WHERE followingCategoryId = ? AND userId = ?`, [categoryId, req.user.id]);
- await db.run(`DELETE FROM following_categories WHERE id = ? AND userId = ?`, [categoryId, req.user.id]);
+ await withTransaction(async (tx) => {
+   await tx.run(`UPDATE following SET followingCategoryId = NULL WHERE followingCategoryId = ? AND userId = ?`, [categoryId, req.user.id]);
+   await tx.run(`UPDATE bookmarks SET followingCategoryId = NULL WHERE followingCategoryId = ? AND userId = ?`, [categoryId, req.user.id]);
+   await tx.run(`DELETE FROM following_categories WHERE id = ? AND userId = ?`, [categoryId, req.user.id]);
+ });
```

**c) `scripts/seed.js`** never cleared `chapter_contributors`, so `DELETE FROM chapters` would fail.
It also deleted from `following` twice:
```diff
  DELETE FROM following;
  DELETE FROM bookmarks;
- DELETE FROM following;
  DELETE FROM following_categories;
  ...
  DELETE FROM chapter_images;
+ DELETE FROM chapter_contributors;
  DELETE FROM chapters;
```

---

## 🟡 17. Transactions for multi-step writes

**Files:** `src/config/database.js`, `comicController.js`, `adminController.js`, `userController.js`

**Reason:** Creating a comic runs 5+ separate statements (comic, genres, formats, contributor). If one
failed halfway, half-created data stayed behind, e.g. a comic with no contributor that nobody could
manage. Approving a submission updated two tables, and they could end up out of sync.

All requests share **one** SQLite connection, so a plain `BEGIN` from two requests at once would fail
with *"cannot start a transaction within a transaction"*. The helper queues transactions so they run
one at a time.

**New helper:**
```js
// All requests share one connection, so transactions are queued: two overlapping BEGINs would fail.
let transactionQueue = Promise.resolve();

export function withTransaction(work) {
  const run = async () => {
    await db.exec('BEGIN IMMEDIATE');
    try {
      const result = await work(db);
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  };

  const result = transactionQueue.then(run, run);
  transactionQueue = result.catch(() => {});
  return result;
}
```

**Used in:** `createComic`, `updateComic`, `createChapter`, `updateComicContributorStatus`,
`updateChapterContributorStatus`, `reviewSubmission` (comic + chapter), `deleteFollowingCategory`.

Example (`createChapter`), **old:**
```js
await db.run(`INSERT INTO chapters ...`, [...]);
for (const file of files) {
  await db.run(`INSERT INTO chapter_images ...`, [...]);
}
await db.run(`INSERT OR IGNORE INTO chapter_contributors ...`, [...]);
```
**new:**
```js
await withTransaction(async (tx) => {
  await tx.run(`INSERT INTO chapters ...`, [...]);
  for (const file of files) {
    await tx.run(`INSERT INTO chapter_images ...`, [...]);
  }
  await tx.run(`INSERT OR IGNORE INTO chapter_contributors ...`, [...]);
});
```

> **Limitation:** single statements from other requests that run *during* a transaction share the
> connection, so they become part of it. That only matters if the transaction rolls back, which is
> rare. Fully isolating them would need a connection pool or `better-sqlite3`'s synchronous
> transactions. This is a candidate for Phase 3.

---

## 🟡 18. Rejected uploads left orphan files

**Files:** `src/middlewares/uploadMiddleware.js`, `src/server.js`

**Reason:** Multer saves files to disk *before* the controller runs. If the controller then rejected
the request (missing fields, 403, 409 duplicate URL), the images stayed in `storage/` forever. This
middleware deletes them whenever the response status is 400 or higher.

**New:**
```js
// Multer writes files before the controller runs; delete them if the request ends up failing
// (validation error, 403, 409, ...) so rejected uploads don't pile up in /storage.
export function cleanupUploadsOnFailure(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    const files = [
      ...(req.file ? [req.file] : []),
      ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
    ];
    files.forEach((file) => fs.unlink(file.path, () => {}));
  });
  next();
}
```
Registered once, globally, in `server.js`: `app.use(cleanupUploadsOnFailure);`

---

## 🟡 19. `/chapters/...` contributor endpoints not mounted

**File:** `src/server.js`

**Reason:** The frontend calls `http://localhost:5000/chapters/:id/contributors`, but
`chaptersRoutes` was only mounted at `/api/chapters`. Every other router is mounted at both paths, so
these calls got a 404.

**New:**
```diff
  app.use('/upload', uploadRoutes);
+ app.use('/chapters', chaptersRoutes);
```

---

## 🟡 20. Duplicate username on profile update → 500

**File:** `src/controllers/userController.js` → `updateProfile`

**Reason:** Changing your username to one that was already taken hit the `UNIQUE` constraint, and the
user got a generic 500.

**New:**
```js
if (username !== undefined && username !== user.username) {
  const taken = await userModel.findUserByUsername(username);
  if (taken) {
    return res.status(409).json({ status: 'fail', message: 'Username already exists' });
  }
}
```

---

## Verification

Run against the real DB on port 5099, with a backup taken first and restored afterwards (so the test
did **not** change your data). **34/34 checks passed:**

```
PASS  GET /comics without filter works
PASS  GET /comics/popular without filter works
PASS  GET /comics?page=abc falls back to page 1
PASS  Legacy plaintext login still works
PASS  Second login (now bcrypt) works
PASS  Wrong password rejected
PASS  Normal user cannot approve comic contributor          (403)
PASS  Normal user cannot list comic contributors            (403)
PASS  Admin can list comic contributors
PASS  Invalid role rejected                                 (400)
PASS  Valid role accepted
PASS  Contributor cannot edit someone else's comic          (403)
PASS  HTML upload as avatar rejected                        (400)
PASS  PNG named .html is stored with .png extension
PASS  User cannot rename shared default category            (404)
PASS  Password change without current password rejected
PASS  Password change with wrong current password rejected
PASS  Password change with correct current password works
PASS  Other sessions are logged out after password change
PASS  Current session stays logged in
PASS  Login with new password works
PASS  Admin can ban
PASS  Banned user's existing token rejected
PASS  Banned user cannot log in                             (403)
PASS  Admin cannot ban self
PASS  /chapters/:id/contributors reachable
PASS  Logged-in chapter read works
PASS  Hidden chapter returns 404 to guests
PASS  Hidden chapter still visible to admin
PASS  CORS denies unknown origin
PASS  CORS allows frontend origin
PASS  helmet nosniff header present
PASS  x-powered-by hidden
PASS  Login rate-limited after 20 attempts                  (429)
```

Also verified:
- A rejected upload (403) leaves no file in `storage/comics` (184 files before → 184 after).
- A **fresh database** gets `foreign_keys = 1` and the `scrollPosition` column, rolls back correctly
  when a transaction throws, rejects a session for a user that doesn't exist (`SQLITE_CONSTRAINT`),
  and runs 3 concurrent transactions without errors.
- Frontend `tsc -b` passes.

---

## Not changed (decisions for you)

1. **Public lists don't filter on `status = 'accept'`.** Pending (unapproved) comics are still shown
   publicly. I didn't add the filter because **every comic (92) and chapter (562) in your current DB is
   `pending`**, so it would empty the site. If you want moderation to actually gate visibility:
   update `seed.js` to insert `status = 'accept'`, run
   `UPDATE comics SET status='accept'; UPDATE chapters SET status='accept';` once, and then add
   `AND status = 'accept'` to the public queries.
2. **Avatars are stored as base64 data URLs** in `users.avatar`, through `PUT /user/profile`, instead
   of going through the upload endpoint. That's why the JSON limit is 1 MB. Moving the cropper to
   `PUT /user/profile/avatar` (multipart) would let you lower it again.
3. **Phase 3** (restructure, `.gitignore` cleanup, stop tracking `comic-platform.sqlite`, merge the
   comic and chapter comment controllers, keep only `/api/*` routes, tests and lint) is still open.

## After pulling these changes

- `cd backend && npm install` (new deps: `bcryptjs`, `helmet`, `express-rate-limit`)
- **Restart the backend.** An already-running `npm start` keeps the old code in memory.
- In production, set `CLIENT_ORIGIN=https://your-frontend-domain`.
