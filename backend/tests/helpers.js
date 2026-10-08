import request from 'supertest';
import app from '../src/app.js';
import * as models from '../src/models/index.js';

export const PREFIX = '/api/v1';

// api().get('/comics') calls GET /api/v1/comics. raw() is for URLs outside the versioned API.
export const api = () => ({
  get: (path) => request(app).get(PREFIX + path),
  post: (path) => request(app).post(PREFIX + path),
  put: (path) => request(app).put(PREFIX + path),
  patch: (path) => request(app).patch(PREFIX + path),
  delete: (path) => request(app).delete(PREFIX + path),
});
export const raw = () => request(app);
export { models };

// 1x1 transparent PNG, enough to pass the upload MIME filter.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

let counter = 0;
export const unique = (prefix) => `${prefix}${Date.now().toString(36)}${counter++}`;

// Registers through the API (so the password goes through bcrypt), then sets the role directly.
export async function createUser(role = 'user', password = 'secret123') {
  const userName = unique('u');
  const res = await api()
    .post('/auth/register')
    .send({ userName, password, email: `${userName}@test.dev`, displayName: userName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);

  const { id } = res.body.data;
  if (role !== 'user') await models.User.update({ role }, { where: { id } });

  const login = await api().post('/auth/login').send({ userName, password });
  return { id, userName, password, token: login.body.data.token };
}

export const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

export async function createComic(owner, overrides = {}) {
  const url = overrides.url || unique('comic-');
  const res = await api()
    .post('/comics')
    .set(auth(owner))
    .field('name', overrides.name || url)
    .field('types', overrides.types || 'manga')
    .field('demographic', 'shounen')
    .field('contentRating', overrides.contentRating || 'safe')
    .field('url', url)
    .attach('coverImage', PNG, { filename: 'cover.png', contentType: 'image/png' });
  if (res.status !== 201) throw new Error(`createComic failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.data.id, url };
}

export async function createChapter(owner, comicId, chapterNumber = 1) {
  const res = await api()
    .post(`/comics/${comicId}/chapters`)
    .set(auth(owner))
    .field('title', `Chapter ${chapterNumber}`)
    .field('chapterNumber', String(chapterNumber))
    .field('url', unique('chap-'))
    .attach('images', PNG, { filename: 'p1.png', contentType: 'image/png' });
  if (res.status !== 201) throw new Error(`createChapter failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.data.id };
}
