import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { api, models, createUser, createComic, createChapter, approve, auth, PNG, PREFIX } from './helpers.js';
import { storageRoot } from '../src/middlewares/uploadMiddleware.js';
import * as comicService from '../src/services/comicService.js';

const coverOf = async (comicId) => (await models.Comic.findByPk(comicId, { raw: true })).coverUrl;
const stored = (relative) => fs.existsSync(path.join(storageRoot, relative));

async function insertComic(fields = {}) {
  const id = randomUUID();
  await models.Comic.create({
    id, name: `c-${id}`, types: 'manga', contentRating: 'safe', demographic: 'shounen', releaseStatus: 'releasing',
    url: `c-${id}`, visibility: 'public', status: 'accept', ...fields,
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
    // Not yet approved (or rejected) by staff: readers never see these either.
    await insertComic({ name: 'Pending Moon', status: 'pending' });
    await insertComic({ name: 'Rejected Moon', status: 'reject' });
  });

  it('returns { data, meta } and only counts public, approved comics', async () => {
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
    await approve({ comicId: comic.id });

    const byId = await api().get(`/comics/${comic.id}`);
    expect(byId.status).toBe(200);
    const bySlug = await api().get(`/comics/${comic.url}`);
    expect(bySlug.body.data.id).toBe(comic.id);
    expect(bySlug.body.data.names[0].country).toBe('global');
  });

  it('comics and chapters awaiting review stay off reader pages for every role; the console previews them', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const admin = await createUser('admin');
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);

    // On reader pages admins and moderators are readers like anyone else.
    for (const user of [owner, moderator, admin]) {
      expect((await api().get(`/comics/${comic.id}`).set(auth(user))).status).toBe(404);
      expect((await api().get(`/comics/${comic.id}/chapters`).set(auth(user))).status).toBe(404);
      expect((await api().get(`/chapters/${chapter.id}`).set(auth(user))).status).toBe(404);
    }
    // The console has its own preview routes, closed to everyone else.
    const preview = await api().get(`/moderation/chapters/${chapter.id}`).set(auth(moderator));
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ id: chapter.id, status: 'pending', metadata: { totalPages: 1 } });
    expect(preview.body.data.images).toHaveLength(1);
    expect((await api().get(`/moderation/chapters/${chapter.id}`).set(auth(owner))).status).toBe(403);
    expect((await api().get('/me/history').set(auth(moderator))).body.data).toEqual([]); // previews are not reading

    // Approving the comic alone does not publish its pending chapter.
    await approve({ comicId: comic.id });
    expect((await api().get(`/comics/${comic.id}`)).status).toBe(200);
    expect((await api().get(`/comics/${comic.id}/chapters`)).body.meta.totalItems).toBe(0);
    expect((await api().get(`/chapters/${chapter.id}`).set(auth(owner))).status).toBe(404);
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
    const one = await createChapter(owner, comic.id, 1);
    const two = await createChapter(owner, comic.id, 2);
    await createChapter(owner, comic.id, 3); // still pending review
    await approve({ comicId: comic.id, chapterIds: [one.id, two.id] });

    const res = await api().get(`/comics/${comic.url}/chapters?sort=-chapterNumber`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.chapterNumber)).toEqual([2, 1]);
    expect(res.body.meta.totalItems).toBe(2);
  });

  it('hidden chapters are not readable by id', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);
    await approve({ comicId: comic.id, chapterIds: [chapter.id] });
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

  it('editing an approved comic keeps it live until the edit is reviewed', async () => {
    const owner = await createUser('contributor');
    const other = await createUser('contributor');
    const moderator = await createUser('moderator');
    const comic = await createComic(owner, { name: 'Old Name' });
    await approve({ comicId: comic.id });

    const edit = (name) => api()
      .patch(`/comics/${comic.id}`)
      .set(auth(owner))
      .field('name', name)
      .field('types', 'manhwa')
      .field('demographic', 'seinen')
      .field('url', comic.url)
      .field('genres', 'Action');
    const res = await edit('New Name');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');

    // Readers still get the approved version.
    const live = await api().get(`/comics/${comic.url}`);
    expect(live.status).toBe(200);
    expect(live.body.data).toMatchObject({ name: 'Old Name', types: 'manga', status: 'accept' });

    // The studio editor and the moderation queue see the edit.
    const draft = await api().get(`/me/editable-comics/${comic.url}`).set(auth(owner));
    expect(draft.body.data).toMatchObject({ name: 'New Name', types: 'manhwa', genres: ['Action'], pendingEdit: true, status: 'pending' });
    expect((await api().get(`/me/editable-comics/${comic.id}`).set(auth(other))).status).toBe(404);
    const queue = await api().get('/moderation/queue').set(auth(moderator));
    expect(queue.body.data.comics.find((c) => c.id === comic.id)).toMatchObject({ status: 'pending', pendingEdit: 1 });
    expect((await api().get(`/moderation/comics/${comic.id}`).set(auth(moderator))).body.data.name).toBe('New Name');

    // Rejecting drops the edit; the comic stays approved and unchanged.
    await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'reject' });
    expect((await api().get(`/comics/${comic.url}`)).body.data).toMatchObject({ name: 'Old Name', status: 'accept' });
    expect((await api().get(`/me/editable-comics/${comic.id}`).set(auth(owner))).body.data.pendingEdit).toBe(false);

    // Accepting applies it.
    await edit('Newer Name');
    await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'accept' });
    const after = await api().get(`/comics/${comic.url}`);
    expect(after.body.data).toMatchObject({ name: 'Newer Name', types: 'manhwa', demographic: 'seinen', genres: ['Action'], status: 'accept' });
  });

  it('editing a comic that is not approved yet changes it in place', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner, { name: 'Draft' });
    await api().patch(`/comics/${comic.id}`).set(auth(owner))
      .field('name', 'Draft 2').field('types', 'manga').field('demographic', 'shounen').field('url', comic.url);
    const draft = await api().get(`/me/editable-comics/${comic.id}`).set(auth(owner));
    expect(draft.body.data).toMatchObject({ name: 'Draft 2', status: 'pending', pendingEdit: false });
  });

  it('edit decisions: own notifications, contributor status back to approved, unused covers deleted', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const comic = await createComic(owner, { name: 'Cover Test' });
    await approve({ comicId: comic.id });
    const liveCover = await coverOf(comic.id);

    const editWithCover = () => api()
      .patch(`/comics/${comic.id}`)
      .set(auth(owner))
      .field('name', 'Cover Test')
      .field('types', 'manga')
      .field('demographic', 'shounen')
      .field('url', comic.url)
      .attach('coverImage', PNG, { filename: 'c.png', contentType: 'image/png' });
    const parkedCover = async () => JSON.parse((await models.Comic.findByPk(comic.id, { raw: true })).pendingChanges).columns.coverUrl;
    const contribution = async () =>
      (await api().get('/me/contributions/comics').set(auth(owner))).body.data.find((c) => c.comicId === comic.id);
    const latestNotice = async () => (await api().get('/me/notifications').set(auth(owner))).body.data[0];

    // A second edit replaces the first one, whose cover nothing uses any more.
    await editWithCover();
    const firstEditCover = await parkedCover();
    await editWithCover();
    const secondEditCover = await parkedCover();
    expect(stored(firstEditCover)).toBe(false);
    expect(stored(secondEditCover)).toBe(true);
    expect(await contribution()).toMatchObject({ status: 'pending', pendingEdit: true });

    // Rejected: the edit's cover goes, the live one stays; the contributor learns the comic is still live.
    await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'reject' });
    expect(stored(secondEditCover)).toBe(false);
    expect(stored(liveCover)).toBe(true);
    expect(await contribution()).toMatchObject({ status: 'accept', pendingEdit: false });
    expect(await latestNotice()).toMatchObject({ title: 'Your edit was rejected', redirectPath: `/comics/${comic.url}` });
    expect((await latestNotice()).content).toContain('The approved version is still live');

    // Accepted: the new cover goes live and the old one is deleted.
    await editWithCover();
    const acceptedCover = await parkedCover();
    await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'accept' });
    expect(await coverOf(comic.id)).toBe(acceptedCover);
    expect(stored(acceptedCover)).toBe(true);
    expect(stored(liveCover)).toBe(false);
    expect(await latestNotice()).toMatchObject({ title: 'Your edit was approved' });
    expect(await contribution()).toMatchObject({ status: 'accept', pendingEdit: false });
  });

  it('a failed edit deletes its upload; an in-place edit deletes the replaced cover', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    const taken = await createComic(owner);

    // Called like the controller does after multer saved the upload (a known name, so we can look for it).
    const upload = `failed-${comic.id}.png`;
    fs.writeFileSync(path.join(storageRoot, 'comics', upload), PNG);
    const input = { name: 'x', types: 'manga', demographic: 'shounen', url: taken.url };
    await expect(comicService.update({ id: owner.id, role: 'contributor' }, comic.id, input, upload)).rejects.toThrow(/already exists/);
    expect(stored(`comics/${upload}`)).toBe(false);

    const oldCover = await coverOf(comic.id);
    await api().patch(`/comics/${comic.id}`).set(auth(owner))
      .field('name', 'x').field('types', 'manga').field('demographic', 'shounen').field('url', comic.url)
      .attach('coverImage', PNG, { filename: 'c.png', contentType: 'image/png' });
    expect(stored(oldCover)).toBe(false);
    expect(stored(await coverOf(comic.id))).toBe(true);
  });
});
