// GET /comics/suggest: search-as-you-type.
import { describe, it, expect } from 'vitest';
import { api, models, createUser, createComic, createChapter, approve } from './helpers.js';

const names = (res) => res.body.data.map((comic) => comic.name);

async function liveComic(owner, name, overrides = {}) {
  const comic = await createComic(owner, { name, ...overrides });
  await approve({ comicId: comic.id });
  return comic;
}

describe('GET /comics/suggest', () => {
  it('ranks exact name, then prefix, then the rest by views; only readable comics', async () => {
    const owner = await createUser('contributor');
    const contains = await liveComic(owner, 'The Dragon Knight');
    const popular = await liveComic(owner, 'Last Dragon');
    const prefix = await liveComic(owner, 'Dragon Ball Super');
    await liveComic(owner, 'Dragon');
    const hidden = await liveComic(owner, 'Dragon Hidden');
    await createComic(owner, { name: 'Dragon Pending' }); // not approved
    await models.Comic.update({ visibility: 'hidden' }, { where: { id: hidden.id } });
    await models.Comic.update({ view: 50 }, { where: { id: popular.id } });
    await models.Comic.update({ view: 10 }, { where: { id: contains.id } });

    const res = await api().get('/comics/suggest?q=%20dragon%20');
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Dragon', 'Dragon Ball Super', 'Last Dragon', 'The Dragon Knight']);
    expect(Object.keys(res.body.data[1]).sort()).toEqual(['coverUrl', 'id', 'latestChapter', 'name', 'rating', 'types', 'url']);

    // latestChapter counts readable chapters only.
    const first = await createChapter(owner, prefix.id, 1);
    await createChapter(owner, prefix.id, 2); // still pending
    await approve({ chapterIds: [first.id] });
    const again = await api().get('/comics/suggest?q=dragon ball');
    expect(again.body.data).toMatchObject([{ id: prefix.id, latestChapter: 1 }]);
  });

  it('answers at most 8 items and honours the content filter', async () => {
    const owner = await createUser('contributor');
    for (let i = 0; i < 9; i++) await liveComic(owner, `Zephyr ${i}`);
    await liveComic(owner, 'Zephyr Adult', { contentRating: 'erotica' });

    expect((await api().get('/comics/suggest?q=zephyr')).body.data).toHaveLength(8);
    expect(names(await api().get('/comics/suggest?q=zephyr&contentRating=erotica'))).toEqual(['Zephyr Adult']);
  });

  it('short queries answer [], long ones 400', async () => {
    for (const q of ['', '%20', 'a', '%20a%20']) {
      const res = await api().get(`/comics/suggest?q=${q}`);
      expect(res.status, q).toBe(200);
      expect(res.body.data, q).toEqual([]);
    }
    expect((await api().get('/comics/suggest')).body.data).toEqual([]);
    expect((await api().get(`/comics/suggest?q=${'x'.repeat(101)}`)).status).toBe(400);
    expect((await api().get('/comics/suggest?q=zz&contentRating=nope')).status).toBe(400);
  });

  // Last in the file: it uses up this IP's budget for the minute.
  it('is rate limited per IP', async () => {
    let status = 200;
    for (let i = 0; i < 61 && status === 200; i++) status = (await api().get('/comics/suggest?q=zz')).status;
    expect(status).toBe(429);
  });
});
