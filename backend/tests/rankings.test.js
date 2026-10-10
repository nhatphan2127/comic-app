// GET /comics/rankings: score = views + 5 × new follows + 3 × new ratings within the period.
import { describe, it, expect } from 'vitest';
import { api, models, createUser, createComic, approve, auth } from './helpers.js';

const daysAgo = (days) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
const ids = (res) => res.body.data.map((comic) => comic.id);

async function liveComic(owner) {
  const comic = await createComic(owner);
  await approve({ comicId: comic.id });
  return comic;
}

const addViews = (comicId, views, day = daysAgo(0)) => models.ComicDailyView.create({ comicId, day, views });

describe('GET /comics/rankings', () => {
  it('rejects an unknown period', async () => {
    const res = await api().get('/comics/rankings?period=year');
    expect(res.status).toBe(400);
  });

  it('ranks readable comics by the period\'s score, ties by follows', async () => {
    const owner = await createUser('contributor');
    const reader = await createUser();
    const [a, b, c, f, hidden, pending] = [
      await liveComic(owner), await liveComic(owner), await liveComic(owner), await liveComic(owner),
      await liveComic(owner), await createComic(owner),
    ];
    await models.Comic.update({ visibility: 'hidden' }, { where: { id: hidden.id } });

    await addViews(a.id, 10); // 10
    await addViews(b.id, 4); // 4 + 5 (follow) + 3 (rating) = 12
    expect((await api().put(`/me/following/${b.id}`).set(auth(reader))).status).toBe(201);
    expect((await api().put(`/me/ratings/${b.id}`).set(auth(reader)).send({ rating: 5 })).status).toBe(200);
    await addViews(c.id, 50, daysAgo(20)); // only inside the month
    await addViews(f.id, 10); // 10, but followed long ago: wins the tie with a
    await api().put(`/me/following/${f.id}`).set(auth(reader));
    await models.Following.update({ createdAt: `${daysAgo(60)} 00:00:00` }, { where: { comicId: f.id } });
    await addViews(hidden.id, 100);
    await addViews(pending.id, 100);

    const week = await api().get('/comics/rankings');
    expect(week.status).toBe(200);
    expect(ids(week)).toEqual([b.id, f.id, a.id]);
    expect(week.body.data.map((comic) => [comic.rank, comic.score])).toEqual([[1, 12], [2, 10], [3, 10]]);
    expect(week.body.data[0]).toMatchObject({ url: b.url, genres: [], latestChapters: [] });
    expect(week.body.meta).toMatchObject({ totalItems: 3, totalPages: 1 });

    expect(ids(await api().get('/comics/rankings?period=day'))).toEqual([b.id, f.id, a.id]);
    expect(ids(await api().get('/comics/rankings?period=month'))).toEqual([c.id, b.id, f.id, a.id]);

    // All time: view + 5 × follow + 3 × ratings from the running totals (no views recorded on comics.view here).
    const all = await api().get('/comics/rankings?period=all');
    expect(all.body.data.map((comic) => [comic.id, comic.score])).toEqual([[b.id, 8], [f.id, 5]]);

    const second = await api().get('/comics/rankings?pageSize=2&page=2');
    expect(second.body.data.map((comic) => [comic.id, comic.rank])).toEqual([[a.id, 3]]);

    expect(ids(await api().get('/comics/rankings?contentRating=erotica'))).toEqual([]);
  });
});
