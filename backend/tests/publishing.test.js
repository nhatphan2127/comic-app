import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { storageRoot } from '../src/middlewares/uploadMiddleware.js';
import { api, auth, createUser, unique, models, PNG } from './helpers.js';

const PASSWORD = 'secret123';

async function createKey(user, body = {}) {
  const res = await api().post('/me/api-keys').set(auth(user)).send({ name: 'script', password: PASSWORD, ...body });
  if (res.status !== 201) throw new Error(`createKey failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

function postComic(token, fields = {}, cover = PNG) {
  const req = api().post('/publish/comics').set(bearer(token));
  const all = { name: unique('Comic '), type: 'manhwa', demographic: 'seinen', contentRating: 'safe', ...fields };
  Object.entries(all).forEach(([k, v]) => req.field(k, v));
  if (cover) req.attach('cover', cover, { filename: 'cover.png', contentType: 'image/png' });
  return req;
}

function postChapter(token, comic, fields = {}, pages = 2) {
  const req = api().post(`/publish/comics/${comic}/chapters`).set(bearer(token));
  Object.entries({ chapterNumber: '1', ...fields }).forEach(([k, v]) => req.field(k, v));
  for (let i = 0; i < pages; i++) req.attach('pages', PNG, { filename: `${i + 1}.png`, contentType: 'image/png' });
  return req;
}

describe('API keys', () => {
  it('only contributors create keys, with their password; the secret is shown once', async () => {
    const reader = await createUser();
    const contributor = await createUser('contributor');

    expect((await api().post('/me/api-keys').set(auth(reader)).send({ name: 'x', password: PASSWORD })).status).toBe(403);
    expect((await api().post('/me/api-keys').set(auth(contributor)).send({ name: 'x', password: 'wrong' })).status).toBe(403);
    expect((await api().post('/me/api-keys').set(auth(contributor)).send({ name: 'x', password: PASSWORD, scopes: ['admin'] })).status).toBe(400);
    expect((await api().post('/me/api-keys').set(auth(contributor)).send({ name: 'x', password: PASSWORD, expiresInDays: 9999 })).status).toBe(400);

    const key = await createKey(contributor);
    expect(key.token).toMatch(/^ink_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
    expect(key.scopes).toEqual(['comics:write', 'chapters:write']);
    expect(key.status).toBe('active');

    const listed = await api().get('/me/api-keys').set(auth(contributor));
    expect(listed.body.data[0].id).toBe(key.id);
    expect(listed.body.data[0].token).toBeUndefined();
    expect(JSON.stringify(listed.body)).not.toContain(key.token.split('_')[2]);

    // Only a hash is stored.
    const row = await models.ApiKey.findByPk(key.id, { raw: true });
    expect(row.tokenHash).not.toContain(key.token);

    const notes = await api().get('/me/notifications').set(auth(contributor));
    expect(notes.body.data.some((n) => n.type === 'system_security')).toBe(true);
  });

  it('keys work only on /publish, and stop working when revoked or when the owner loses the role', async () => {
    const contributor = await createUser('contributor');
    const key = await createKey(contributor);

    const who = await api().get('/publish/whoami').set(bearer(key.token));
    expect(who.status).toBe(200);
    expect(who.body.data.user.username).toBe(contributor.userName);

    // A key is not a session, and a session is not a key.
    expect((await api().get('/me').set(bearer(key.token))).status).toBe(401);
    expect((await api().get('/publish/whoami').set(auth(contributor))).status).toBe(401);
    expect((await api().get('/publish/whoami')).status).toBe(401);
    // Right prefix, wrong secret.
    const forged = key.token.slice(0, -4) + 'AAAA';
    expect((await api().get('/publish/whoami').set(bearer(forged))).status).toBe(401);

    await models.User.update({ role: 'user' }, { where: { id: contributor.id } });
    expect((await api().get('/publish/whoami').set(bearer(key.token))).status).toBe(403);
    await models.User.update({ role: 'contributor' }, { where: { id: contributor.id } });

    expect((await api().delete(`/me/api-keys/${key.id}`).set(auth(contributor))).status).toBe(204);
    const revoked = await api().get('/publish/whoami').set(bearer(key.token));
    expect(revoked.status).toBe(401);
    expect(revoked.body.detail).toMatch(/revoked/);
  });

  it('expired keys are refused', async () => {
    const contributor = await createUser('contributor');
    const key = await createKey(contributor);
    await models.ApiKey.update({ expiresAt: '2000-01-01T00:00:00.000Z' }, { where: { id: key.id } });
    expect((await api().get('/publish/whoami').set(bearer(key.token))).status).toBe(401);
  });
});

describe('publishing comics and chapters', () => {
  it('creates a comic (pending review) with strict validation', async () => {
    const contributor = await createUser('contributor');
    const { token } = await createKey(contributor);

    expect((await postComic(token, { type: 'novel' })).status).toBe(400);
    expect((await postComic(token, { genres: 'Action, Cooking' })).status).toBe(400);
    expect((await postComic(token, {}, null)).status).toBe(400);
    // Declared as PNG but isn't one.
    const fake = await postComic(token, {}, Buffer.from('<script>alert(1)</script>'));
    expect(fake.status).toBe(415);

    const slug = unique('tieu-thuyet-');
    const res = await postComic(token, { name: 'Tôi Là Đại Hiệp', url: slug, genres: 'action, slice of life', releasingYear: '2024' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/comics/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({ url: slug, name: 'Tôi Là Đại Hiệp', status: 'pending' });
    // The cover lands where coverUrl points (comics/), not among chapter pages.
    const stored = await models.Comic.findByPk(res.body.data.id, { attributes: ['coverUrl'], raw: true });
    expect(stored.coverUrl).toMatch(/^comics\//);
    expect(fs.existsSync(path.join(storageRoot, stored.coverUrl))).toBe(true);
    expect((await postComic(token, { url: slug })).status).toBe(409);

    // Without a url the slug comes from the name.
    const name = unique('Đường Về Nhà ');
    const auto = await postComic(token, { name });
    expect(auto.body.data.url).toMatch(/^duong-ve-nha-/);
  });

  it('uploads chapters by comic slug, refuses duplicates and other people\'s unreviewed comics', async () => {
    const owner = await createUser('contributor');
    const stranger = await createUser('contributor');
    const ownerKey = (await createKey(owner)).token;
    const strangerKey = (await createKey(stranger)).token;
    const comic = (await postComic(ownerKey)).body.data;

    const res = await postChapter(ownerKey, comic.url, { chapterNumber: '1.5' }, 3);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ chapterNumber: 1.5, title: 'Chapter 1.5', pages: 3, status: 'pending', url: `${comic.url}-chapter-1-5` });
    const pages = await models.ChapterImage.findAll({ where: { chapterId: res.body.data.id }, order: [['pageNumber', 'ASC']], raw: true });
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);

    expect((await postChapter(ownerKey, comic.url, { chapterNumber: '1.5' })).status).toBe(409);
    expect((await postChapter(ownerKey, comic.url, { chapterNumber: 'abc' })).status).toBe(400);
    expect((await postChapter(ownerKey, comic.url, {}, 0)).status).toBe(400);
    expect((await postChapter(ownerKey, 'no-such-comic')).status).toBe(404);
    // The comic is still pending: only its contributors can add chapters.
    expect((await postChapter(strangerKey, comic.url, { chapterNumber: '2' })).status).toBe(404);

    await models.Comic.update({ status: 'accept' }, { where: { id: comic.id } });
    expect((await postChapter(strangerKey, comic.id, { chapterNumber: '2' })).status).toBe(201);
  });

  it('keys can be limited to one scope', async () => {
    const contributor = await createUser('contributor');
    const { token } = await createKey(contributor, { scopes: ['chapters:write'] });
    const res = await postComic(token);
    expect(res.status).toBe(403);
    expect(res.body.detail).toMatch(/comics:write/);
  });
});
