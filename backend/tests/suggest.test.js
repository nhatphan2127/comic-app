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

  it('ignores accents and case, in names, other names, authors and artists', async () => {
    const owner = await createUser('contributor');
    const sword = await liveComic(owner, 'Kiếm Thần Vô Song');
    const decomposed = await liveComic(owner, 'Đường Về Nhà'.normalize('NFD'));

    for (const q of ['kiem than', 'KIẾM THẦN', 'Kiếm', 'Kiếm'.normalize('NFD'), 'vô song']) {
      expect(names(await api().get(`/comics/suggest?q=${encodeURIComponent(q)}`)), q).toEqual(['Kiếm Thần Vô Song']);
    }
    expect((await api().get('/comics/suggest?q=duong ve')).body.data.map((c) => c.id)).toEqual([decomposed.id]);

    // Other names, authors and artists are folded too, and kept up to date when they change.
    await models.ComicOtherName.create({ id: 'on-1', comicId: sword.id, name: 'Thanh Gươm Huyền Thoại', country: 'vi' });
    expect(names(await api().get('/comics/suggest?q=thanh guom'))).toEqual(['Kiếm Thần Vô Song']);
    await models.ComicOtherName.destroy({ where: { id: 'on-1' } });
    expect(names(await api().get('/comics/suggest?q=thanh guom'))).toEqual([]);

    const author = await models.Author.create({ id: 'au-1', name: 'Nguyễn Văn Ánh' });
    await models.Comic.update({ authorId: author.id }, { where: { id: sword.id } });
    expect(names(await api().get('/comics/suggest?q=nguyen van anh'))).toEqual(['Kiếm Thần Vô Song']);
    await models.Author.update({ name: 'Trần Thị Bích' }, { where: { id: author.id } });
    expect(names(await api().get('/comics/suggest?q=tran thi bich'))).toEqual(['Kiếm Thần Vô Song']);

    // Renaming the comic itself, and the catalogue search uses the same matching.
    await models.Comic.update({ name: 'Ánh Trăng' }, { where: { id: sword.id } });
    expect(names(await api().get('/comics/suggest?q=anh trang'))).toEqual(['Ánh Trăng']);
    expect(names(await api().get('/comics?q=ANH TRANG'))).toEqual(['Ánh Trăng']);
  });

  it('treats % and _ as plain characters', async () => {
    const owner = await createUser('contributor');
    await liveComic(owner, '100% Romance');
    await liveComic(owner, '1000 Romance');
    expect(names(await api().get('/comics/suggest?q=100%25'))).toEqual(['100% Romance']);
    expect(names(await api().get('/comics/suggest?q=10_0'))).toEqual([]);
  });

  // Last in the file: it uses up this IP's budget for the minute.
  it('is rate limited per IP', async () => {
    let status = 200;
    for (let i = 0; i < 61 && status === 200; i++) status = (await api().get('/comics/suggest?q=zz')).status;
    expect(status).toBe(429);
  });
});
