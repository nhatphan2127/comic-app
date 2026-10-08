import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { api, models, createUser, createComic, createChapter, auth, PREFIX } from './helpers.js';

async function insertComic(fields = {}) {
  const id = randomUUID();
  await models.Comic.create({
    id, name: `c-${id}`, types: 'manga', contentRating: 'safe', demographic: 'shounen', releaseStatus: 'releasing',
    url: `c-${id}`, visibility: 'public', ...fields,
  });
  return id;
}

describe('GET /comics (pagination, filtering, sorting)', () => {
  // This file has its own in-memory DB, so these are the only comics besides those created below.
  beforeAll(async () => {
    await insertComic({ name: 'Alpha Blade', view: 50, rating: 4.5, contentRating: 'safe', types: 'manga' });
    await insertComic({ name: 'Beta Moon', view: 900, rating: 3, contentRating: 'suggestive', types: 'manhwa' });
    await insertComic({ name: 'Gamma Ray', view: 10, rating: 0, contentRating: 'erotica', types: 'manhua' });
    for (let i = 0; i < 25; i += 1) await insertComic({ visibility: 'hidden' });
  });

  it('returns { data, meta } and only counts public comics', async () => {
    const res = await api().get('/comics?pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });

    const page2 = await api().get('/comics?pageSize=2&page=2');
    expect(page2.body.data).toHaveLength(1);
  });

  it('items carry genres and latest chapters', async () => {
    const res = await api().get('/comics');
    expect(res.body.data[0]).toHaveProperty('genres');
    expect(res.body.data[0]).toHaveProperty('latestChapters');
  });

  it('sorts by any whitelisted field, "-" meaning descending', async () => {
    const popular = await api().get('/comics?sort=-view');
    expect(popular.body.data.map((c) => c.name)).toEqual(['Beta Moon', 'Alpha Blade', 'Gamma Ray']);

    const topRated = await api().get('/comics?sort=-rating,-view');
    expect(topRated.body.data[0].name).toBe('Alpha Blade');

    const byName = await api().get('/comics?sort=name');
    expect(byName.body.data.map((c) => c.name)).toEqual(['Alpha Blade', 'Beta Moon', 'Gamma Ray']);
  });

  it('filters by enum lists (comma-separated or repeated) and by text', async () => {
    const csv = await api().get('/comics?contentRating=safe,suggestive');
    expect(csv.body.meta.totalItems).toBe(2);

    const repeated = await api().get('/comics?contentRating=safe&contentRating=erotica');
    expect(repeated.body.data.map((c) => c.name).sort()).toEqual(['Alpha Blade', 'Gamma Ray']);

    const type = await api().get('/comics?type=manhwa');
    expect(type.body.data.map((c) => c.name)).toEqual(['Beta Moon']);

    const search = await api().get('/comics?q=moon');
    expect(search.body.data.map((c) => c.name)).toEqual(['Beta Moon']);
  });

  it('rejects invalid query parameters with 400 problem details', async () => {
    for (const query of ['page=0', 'page=abc', 'pageSize=500', 'sort=password', 'contentRating=nsfw', 'type=novel']) {
      const res = await api().get(`/comics?${query}`);
      expect(res.status, query).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400 });
    }
  });
});

describe('comics', () => {
  it('returns 404 for an unknown comic', async () => {
    expect((await api().get('/comics/does-not-exist')).status).toBe(404);
  });

  it('creating a comic answers 201 with Location; detail works by id and by url slug', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);

    const byId = await api().get(`/comics/${comic.id}`);
    expect(byId.status).toBe(200);
    const bySlug = await api().get(`/comics/${comic.url}`);
    expect(bySlug.body.data.id).toBe(comic.id);
    expect(bySlug.body.data.names[0].country).toBe('global');
  });

  it('sets Location on create', async () => {
    const owner = await createUser('contributor');
    const { id } = await createComic(owner);
    const chapter = await api()
      .post(`/comics/${id}/chapters`)
      .set(auth(owner))
      .field('title', 'One')
      .field('chapterNumber', '1')
      .field('url', `${id}-ch1`)
      .attach('images', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'), { filename: 'p.png', contentType: 'image/png' });
    expect(chapter.status).toBe(201);
    expect(chapter.headers.location).toBe(`${PREFIX}/chapters/${chapter.body.data.id}`);
  });

  it('lists the public chapters of a comic, paginated and sortable', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    await createChapter(owner, comic.id, 1);
    await createChapter(owner, comic.id, 2);

    const res = await api().get(`/comics/${comic.url}/chapters?sort=-chapterNumber`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.chapterNumber)).toEqual([2, 1]);
    expect(res.body.meta.totalItems).toBe(2);
  });

  it('hidden chapters are not readable by id', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);
    expect((await api().get(`/chapters/${chapter.id}`)).status).toBe(200);

    await models.Chapter.update({ visibility: 'hidden' }, { where: { id: chapter.id } });
    expect((await api().get(`/chapters/${chapter.id}`)).status).toBe(404);
  });

  it('contributor review routes work for comics and chapters', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);

    const chapterRes = await api().get(`/chapters/${chapter.id}/contributors`).set(auth(moderator));
    expect(chapterRes.status).toBe(200);
    expect(chapterRes.body.data.chapter.id).toBe(chapter.id);
    expect(chapterRes.body.data.contributors[0].userId).toBe(owner.id);

    const comicRes = await api().get(`/comics/${comic.id}/contributors`).set(auth(moderator));
    expect(comicRes.body.data.comic.id).toBe(comic.id);

    const update = await api()
      .patch(`/chapters/${chapter.id}/contributors/${owner.id}`)
      .set(auth(moderator))
      .send({ status: 'accept' });
    expect(update.status).toBe(200);
    expect((await models.Chapter.findByPk(chapter.id, { raw: true })).status).toBe('accept');
  });

  it('a duplicate comic url returns 409', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    await expect(createComic(owner, { url: comic.url })).rejects.toThrow(/409/);
  });
});
