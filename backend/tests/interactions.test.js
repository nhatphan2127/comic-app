import { describe, it, expect } from 'vitest';
import { api, models, createUser, createComic, createChapter, auth, PREFIX } from './helpers.js';

const followCount = async (comicId) => (await models.Comic.findByPk(comicId, { raw: true })).follow;

describe('/me interactions', () => {
  it('PUT /me/following is idempotent: 201 then 200, counted once; DELETE answers 204', async () => {
    const owner = await createUser('contributor');
    const reader = await createUser();
    const comic = await createComic(owner);

    expect((await api().get(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(404);

    const first = await api().put(`/me/following/${comic.id}`).set(auth(reader));
    expect(first.status).toBe(201);
    expect(first.headers.location).toBe(`${PREFIX}/me/following/${comic.id}`);
    expect((await api().put(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(200);
    expect(await followCount(comic.id)).toBe(1);

    const status = await api().get(`/me/following/${comic.id}`).set(auth(reader));
    expect(status.status).toBe(200);
    expect(status.body.data.comicId).toBe(comic.id);

    expect((await api().delete(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(204);
    expect((await api().delete(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(204);
    expect(await followCount(comic.id)).toBe(0);
  });

  it('PUT /me/following moves a followed comic to another category', async () => {
    const owner = await createUser('contributor');
    const reader = await createUser();
    const comic = await createComic(owner);
    const cat = await api().post('/me/following-categories').set(auth(reader)).send({ category: 'Later' });
    expect(cat.status).toBe(201);
    expect(cat.headers.location).toBe(`${PREFIX}/me/following-categories/${cat.body.data.id}`);

    await api().put(`/me/following/${comic.id}`).set(auth(reader));
    const moved = await api().put(`/me/following/${comic.id}`).set(auth(reader)).send({ categoryId: cat.body.data.id });
    expect(moved.status).toBe(200);
    expect(moved.body.data.categoryId).toBe(cat.body.data.id);
  });

  it('cannot follow into a category owned by another user', async () => {
    const owner = await createUser('contributor');
    const alice = await createUser();
    const bob = await createUser();
    const comic = await createComic(owner);

    const cat = await api().post('/me/following-categories').set(auth(alice)).send({ category: 'Fav' });
    const res = await api().put(`/me/following/${comic.id}`).set(auth(bob)).send({ categoryId: cat.body.data.id });
    expect(res.status).toBe(404);
  });

  it('returns 404 when following an unknown comic', async () => {
    const reader = await createUser();
    expect((await api().put('/me/following/nope').set(auth(reader))).status).toBe(404);
  });

  it('rating keeps a correct average and validates the range', async () => {
    const owner = await createUser('contributor');
    const a = await createUser();
    const b = await createUser();
    const comic = await createComic(owner);

    expect((await api().put(`/me/ratings/${comic.id}`).set(auth(a)).send({ rating: 9 })).status).toBe(400);

    await api().put(`/me/ratings/${comic.id}`).set(auth(a)).send({ rating: 5 });
    const res = await api().put(`/me/ratings/${comic.id}`).set(auth(b)).send({ rating: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ comicId: comic.id, userRating: 2, averageRating: 3.5 });

    // Re-rating replaces the old value instead of adding a new one.
    const again = await api().put(`/me/ratings/${comic.id}`).set(auth(b)).send({ rating: 4 });
    expect(again.body.data.averageRating).toBe(4.5);
  });

  it('reading history is a paginated collection', async () => {
    const owner = await createUser('contributor');
    const reader = await createUser();
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);

    expect((await api().put(`/me/history/${chapter.id}`).set(auth(reader)).send({ currentPage: 0 })).status).toBe(400);
    const hist = await api().put(`/me/history/${chapter.id}`).set(auth(reader)).send({ currentPage: 3 });
    expect(hist.status).toBe(200);
    const history = await api().get('/me/history').set(auth(reader));
    expect(history.body.data[0].currentPage).toBe(3);
    expect(history.body.meta.totalItems).toBe(1);

    expect((await api().delete('/me/history').set(auth(reader))).status).toBe(204);
    expect((await api().get('/me/history').set(auth(reader))).body.meta.totalItems).toBe(0);
  });
});
