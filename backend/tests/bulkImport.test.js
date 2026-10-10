import fs from 'node:fs';
import path from 'node:path';
import yazl from 'yazl';
import { describe, it, expect, vi } from 'vitest';
import { storageRoot } from '../src/middlewares/uploadMiddleware.js';
import { api, auth, createUser, createComic, unique, models, PNG } from './helpers.js';

// These tests count stored files, so they get a storage folder no other test file writes to in parallel.
// vi.hoisted runs before the imports above, i.e. before uploadMiddleware reads STORAGE_ROOT.
vi.hoisted(() => {
  process.env.STORAGE_ROOT = `${process.env.STORAGE_ROOT}-bulk`;
});

const PASSWORD = 'secret123';
// Smallest valid GIF: lets a test tell pages apart by the extension they are stored with.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function createKey(user, body = {}) {
  return api().post('/me/api-keys').set(auth(user)).send({ name: 'bulk', password: PASSWORD, ...body });
}

async function adminKey() {
  const admin = await createUser('admin');
  const res = await createKey(admin, { scopes: ['bulk:write'] });
  expect(res.status).toBe(201);
  return { admin, token: res.body.data.token };
}

// { 'Lib/A/comic.json': {...} | Buffer } → zip Buffer
function zipOf(files) {
  const zip = new yazl.ZipFile();
  for (const [name, content] of Object.entries(files)) {
    zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(JSON.stringify(content)), name);
  }
  zip.end();
  return new Promise((resolve, reject) => {
    const chunks = [];
    zip.outputStream.on('data', (c) => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
  });
}

const comicJson = (overrides = {}) => ({ name: unique('Bulk '), type: 'manga', demographic: 'shounen', contentRating: 'safe', ...overrides });

const postBulk = (token, archive, { filename = 'library.zip', contentType = 'application/zip' } = {}) => {
  const req = api().post('/publish/bulk').set(bearer(token));
  return archive ? req.attach('archive', archive, { filename, contentType }) : req;
};

const pagesOf = (chapterId) =>
  models.ChapterImage.findAll({ where: { chapterId }, order: [['pageNumber', 'ASC']], raw: true });
const storedPageCount = () => fs.readdirSync(path.join(storageRoot, 'chapter-images')).length;

describe('bulk:write keys', () => {
  it('only admins can hold the bulk scope, and it is never given by default', async () => {
    const contributor = await createUser('contributor');
    const moderator = await createUser('moderator');
    expect((await createKey(contributor, { scopes: ['bulk:write'] })).status).toBe(403);
    expect((await createKey(moderator, { scopes: ['chapters:write', 'bulk:write'] })).status).toBe(403);

    const admin = await createUser('admin');
    const plain = await createKey(admin);
    expect(plain.body.data.scopes).toEqual(['comics:write', 'chapters:write']);
    const archive = await zipOf({ 'A/comic.json': comicJson(), 'A/cover.png': PNG });
    expect((await postBulk(plain.body.data.token, archive)).status).toBe(403);

    const contributorKey = (await createKey(contributor)).body.data.token;
    expect((await postBulk(contributorKey, archive)).status).toBe(403);
  });

  it('an admin who is demoted loses the bulk scope at once', async () => {
    const { admin, token } = await adminKey();
    await models.User.update({ role: 'contributor' }, { where: { id: admin.id } });
    const who = await api().get('/publish/whoami').set(bearer(token));
    expect(who.body.data.key.scopes).toEqual([]);
    const res = await postBulk(token, await zipOf({ 'A/comic.json': comicJson(), 'A/cover.png': PNG }));
    expect(res.status).toBe(403);
  });
});

describe('POST /publish/bulk', () => {
  it('imports every comic folder in the zip, chapters in number order and pages in natural order', async () => {
    const { token } = await adminKey();
    const one = comicJson({ genres: ['Action', 'Romance'], releasingYear: 2024 });
    const two = comicJson();
    const archive = await zipOf({
      // Nested in a library folder, with macOS junk next to it.
      'Library/One/comic.json': one,
      'Library/One/cover.png': PNG,
      'Library/One/Chapter 10/1.png': PNG,
      'Library/One/Chapter 2 - The Return/10.gif': GIF,
      'Library/One/Chapter 2 - The Return/2.png': PNG,
      'Library/One/Chapter 2 - The Return/notes.txt': Buffer.from('ignored'),
      'Library/One/extras/1.png': PNG, // no number: not a chapter
      '__MACOSX/Library/One/._cover.png': Buffer.from('junk'),
      'Library/Two/comic.json': two,
      'Library/Two/cover.png': PNG,
      'Library/Two/Ch 0.5/a.png': PNG,
    });

    const res = await postBulk(token, archive);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ comics: { created: 2, existing: 0, failed: 0 }, chapters: { created: 3, skipped: 0, failed: 0 } });

    const [first, second] = res.body.data.comics;
    expect(first).toMatchObject({ folder: 'Library/One', action: 'created', name: one.name, status: 'pending' });
    expect(first.chapters.map((c) => [c.chapterNumber, c.action, c.title, c.pages])).toEqual([
      [2, 'created', 'The Return', 2],
      [10, 'created', 'Chapter 10', 1],
    ]);
    expect(second.chapters[0]).toMatchObject({ chapterNumber: 0.5, action: 'created' });

    // 2.png comes before 10.gif, whatever order the zip stored them in.
    const pages = await pagesOf(first.chapters[0].id);
    expect(pages.map((p) => path.extname(p.urlPath))).toEqual(['.png', '.gif']);
    expect(pages.every((p) => fs.existsSync(path.join(storageRoot, p.urlPath)))).toBe(true);

    // comic.json's numbers and arrays are accepted like form fields.
    const comic = await models.Comic.findByPk(first.id, { raw: true });
    expect(Number(comic.releasingYear)).toBe(2024);
  });

  it('importing the same zip again creates nothing; an existing comic matched by url receives new chapters', async () => {
    const { token } = await adminKey();
    const owner = await createUser('contributor');
    const existing = await createComic(owner);
    const files = {
      'Existing/comic.json': { url: existing.url },
      'Existing/Chapter 1/1.png': PNG,
      'New/comic.json': comicJson(),
      'New/cover.png': PNG,
      'New/Chapter 1/1.png': PNG,
    };

    const first = await postBulk(token, await zipOf(files));
    expect(first.body.data.comics[0]).toMatchObject({ action: 'existing', id: existing.id });
    expect(first.body.data.summary.chapters.created).toBe(2);

    const before = storedPageCount();
    const again = await postBulk(token, await zipOf(files));
    expect(again.status).toBe(200);
    expect(again.body.data.summary).toEqual({ comics: { created: 0, existing: 2, failed: 0 }, chapters: { created: 0, skipped: 2, failed: 0 } });
    expect(again.body.data.comics[1].chapters[0].reason).toMatch(/already exists/);
    expect(storedPageCount()).toBe(before);
  });

  it('a bad comic or chapter is reported and cleaned up; the rest is still imported', async () => {
    const { token } = await adminKey();
    const archive = await zipOf({
      'Good/comic.json': comicJson(),
      'Good/cover.png': PNG,
      'Good/Chapter 1/1.png': PNG,
      'Good/Chapter 2/1.png': PNG,
      'Good/Chapter 2/2.png': Buffer.from('<script>alert(1)</script>'), // named .png, isn't one
      'NoCover/comic.json': comicJson(),
      'NoCover/Chapter 1/1.png': PNG,
      'BadJson/comic.json': Buffer.from('{"name":'),
      'BadType/comic.json': comicJson({ type: 'novel' }),
      'BadType/cover.png': PNG,
    });
    const coversBefore = fs.readdirSync(path.join(storageRoot, 'comics')).length;
    const pagesBefore = storedPageCount();

    const res = await postBulk(token, archive);
    expect(res.status).toBe(200);
    const byFolder = Object.fromEntries(res.body.data.comics.map((c) => [c.folder, c]));
    expect(byFolder.Good.chapters.map((c) => [c.chapterNumber, c.action, c.httpStatus])).toEqual([[1, 'created', undefined], [2, 'failed', 415]]);
    expect(byFolder.NoCover).toMatchObject({ action: 'failed', httpStatus: 400, reason: expect.stringMatching(/cover/) });
    expect(byFolder.BadJson).toMatchObject({ action: 'failed', reason: expect.stringMatching(/JSON/) });
    expect(byFolder.BadType).toMatchObject({ action: 'failed', reason: expect.stringMatching(/type/) });

    // Only the good comic's cover and its one good page were kept.
    expect(fs.readdirSync(path.join(storageRoot, 'comics')).length).toBe(coversBefore + 1);
    expect(storedPageCount()).toBe(pagesBefore + 1);
  });

  it('refuses what is not a usable zip', async () => {
    const { token } = await adminKey();
    expect((await postBulk(token, null)).status).toBe(400);
    expect((await postBulk(token, Buffer.from('not a zip at all'))).status).toBe(400);
    expect((await postBulk(token, PNG, { filename: 'cover.png', contentType: 'image/png' })).status).toBe(415);
    const empty = await postBulk(token, await zipOf({ 'readme.txt': Buffer.from('hi') }));
    expect(empty.status).toBe(400);
    expect(empty.body.detail).toMatch(/comic\.json/);
  });
});
