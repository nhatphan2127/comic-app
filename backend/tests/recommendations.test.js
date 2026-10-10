// Recommendations: the pure algorithm (services/recommendationService.js), GET /me/recommendations
// (hybrid CF + CBF) and GET /comics/:comicId/similar (content only).
import { describe, it, expect, beforeEach } from 'vitest';
import { api, models, createUser, createComic, createChapter, approve, auth } from './helpers.js';
import {
  interactionWeight, cosine, buildItemVectors, contentScores, userBasedScores, blend, diversify, clearCache,
} from '../src/services/recommendationService.js';

const ids = (res) => res.body.data.map((comic) => comic.id);
const vector = (entries) => new Map(Object.entries(entries));

async function liveComic(owner, overrides) {
  const comic = await createComic(owner, overrides);
  await approve({ comicId: comic.id });
  return comic;
}

const follow = (user, comic) => api().put(`/me/following/${comic.id}`).set(auth(user));
const recommendations = (user, query = '') => api().get(`/me/recommendations${query}`).set(auth(user));

beforeEach(() => clearCache());

describe('recommendation algorithm (pure functions)', () => {
  it('w(u,i) = 3·follow + 2·min(chapters, 10)/10 + (rating − 3), never below 0', () => {
    expect(interactionWeight({ followed: 1, chaptersRead: 0, rating: null })).toBe(3);
    expect(interactionWeight({ followed: 0, chaptersRead: 5, rating: null })).toBe(1);
    expect(interactionWeight({ followed: 0, chaptersRead: 40, rating: null })).toBe(2);
    expect(interactionWeight({ followed: 1, chaptersRead: 10, rating: 5 })).toBe(7);
    expect(interactionWeight({ followed: 1, chaptersRead: 0, rating: 1 })).toBe(1);
    expect(interactionWeight({ followed: 0, chaptersRead: 0, rating: 1 })).toBe(0);
    expect(interactionWeight({ followed: 0, chaptersRead: 0, rating: 3 })).toBe(0);
  });

  it('cosine ignores length and is 0 for vectors sharing nothing', () => {
    expect(cosine(vector({ a: 1, b: 2 }), vector({ a: 2, b: 4 }))).toBeCloseTo(1);
    expect(cosine(vector({ a: 1 }), vector({ b: 1 }))).toBe(0);
    expect(cosine(new Map(), vector({ a: 1 }))).toBe(0);
    expect(cosine(vector({ a: 1, b: 1 }), vector({ a: 1 }))).toBeCloseTo(Math.SQRT1_2);
  });

  it('IDF: a rare genre weighs more than a common one, a feature every comic has weighs nothing', () => {
    const comics = [
      { id: 'w', features: ['type:manhua', 'genre:action', 'genre:wuxia'] },
      { id: 'a1', features: ['type:manhua', 'genre:action'] },
      { id: 'a2', features: ['type:manhua', 'genre:action', 'genre:romance'] },
      { id: 'r', features: ['type:manhua', 'genre:romance'] },
    ];
    const { vectors, idf, mainGenre } = buildItemVectors(comics);
    expect(idf.get('genre:wuxia')).toBeCloseTo(Math.log(4));
    expect(idf.get('type:manhua')).toBe(0);
    expect(vectors.get('w').get('genre:wuxia')).toBeGreaterThan(vectors.get('w').get('genre:action'));
    expect(vectors.get('w').has('type:manhua')).toBe(false);
    expect([...vectors.get('w').values()].reduce((s, x) => s + x * x, 0)).toBeCloseTo(1);
    expect(mainGenre.get('w')).toBe('genre:action');
  });

  it('content scores follow the liked features and move away from disliked ones', () => {
    const { vectors } = buildItemVectors([
      { id: 'liked', features: ['genre:wuxia'] },
      { id: 'wuxia', features: ['genre:wuxia', 'genre:comedy'] },
      { id: 'comedy', features: ['genre:comedy'] },
      { id: 'romance', features: ['genre:romance'] },
      { id: 'bad', features: ['genre:comedy'] },
    ]);
    const scores = contentScores(new Map([['liked', 3]]), ['bad'], vectors);
    expect(scores.get('wuxia')).toBeGreaterThan(0);
    expect(scores.has('comedy')).toBe(false); // pushed below 0 by the disliked comedy
    expect(scores.has('romance')).toBe(false);
  });

  it('content scores below 0.2 are dropped: a short list beats a list of weak matches', () => {
    const vectors = new Map([
      ['liked', vector({ a: 1 })],
      ['close', vector({ a: 0.6, z: 0.8 })], // cos 0.6
      ['faint', vector({ a: 0.1, z: Math.sqrt(0.99) })], // cos 0.1
    ]);
    const scores = contentScores(new Map([['liked', 3]]), [], vectors);
    expect(scores.get('close')).toBeCloseTo(0.6);
    expect(scores.has('faint')).toBe(false);
  });

  it('user-based CF needs 2 comics in common and 2 supporting neighbours', () => {
    const likes = new Map([['x', 3], ['y', 3]]);
    const others = new Map([
      ['b', new Map([['x', 3], ['y', 3], ['z', 3]])],
      ['c', new Map([['x', 3], ['y', 2], ['z', 5], ['q', 3]])],
      ['d', new Map([['x', 3], ['lonely', 7]])], // one comic in common: not a neighbour
    ]);
    const { scores, neighbourCount } = userBasedScores(likes, others);
    expect(neighbourCount).toBe(2);
    // sim(a,b) = cos × 2/5 = 0.327, sim(a,c) = 0.206; score = Σ sim·w = 0.327·3 + 0.206·5
    expect(scores.get('z').supporters).toBe(2);
    expect(scores.get('z').score).toBeCloseTo((18 / Math.sqrt(18 * 27)) * 0.4 * 3 + (15 / Math.sqrt(18 * 47)) * 0.4 * 5);
    expect(scores.has('q')).toBe(false); // one supporter only
    expect(scores.has('lonely')).toBe(false);
  });

  it('blend trusts CF more with more neighbours (α = min(0.7, |N|/20))', () => {
    const cf = new Map([['a', { score: 4, supporters: 2 }], ['b', { score: 2, supporters: 3 }]]);
    const cb = new Map([['b', 0.5], ['c', 0.25]]);
    const few = blend({ cf, cb, neighbourCount: 2 });
    expect(few.map((item) => item.comicId)).toEqual(['b', 'c', 'a']);
    expect(few[0].score).toBeCloseTo(0.1 * 0.5 + 0.9 * 1);
    const many = blend({ cf, cb, neighbourCount: 40, isCandidate: (id) => id !== 'b' });
    expect(many.map((item) => [item.comicId, Number(item.score.toFixed(3))])).toEqual([['a', 0.7], ['c', 0.3]]);
  });

  it('diversify keeps at most 3 comics of the same main genre in a row', () => {
    const ranked = ['a1', 'a2', 'a3', 'a4', 'b1', 'a5'].map((comicId) => ({ comicId }));
    const out = diversify(ranked, (id) => id[0]).map((item) => item.comicId);
    expect(out).toEqual(['a1', 'a2', 'a3', 'b1', 'a4', 'a5']);
  });
});

describe('GET /me/recommendations', () => {
  it('needs a login and a sane limit', async () => {
    expect((await api().get('/me/recommendations')).status).toBe(401);
    const user = await createUser();
    expect((await recommendations(user, '?limit=0')).status).toBe(400);
    expect((await recommendations(user, '?limit=51')).status).toBe(400);
  });

  it('cold start: a reader who liked nothing gets the trending comics', async () => {
    const owner = await createUser('contributor');
    const [a, b] = [await liveComic(owner), await liveComic(owner)];
    await models.ComicDailyView.bulkCreate([
      { comicId: a.id, day: new Date().toISOString().slice(0, 10), views: 3 },
      { comicId: b.id, day: new Date().toISOString().slice(0, 10), views: 7 },
    ]);
    const week = await api().get('/comics/rankings?contentRating=safe,suggestive');

    const res = await recommendations(await createUser());
    expect(res.status).toBe(200);
    expect(ids(res).slice(0, week.body.data.length)).toEqual(ids(week));
    expect(res.body.data.every((comic) => comic.reason.type === 'trending')).toBe(true);
    expect(res.body.data[0]).toMatchObject({ url: expect.any(String), genres: expect.any(Array), latestChapters: [] });
  });

  it('collaborative filtering: what readers with the same tastes like', async () => {
    const owner = await createUser('contributor');
    const x = await liveComic(owner, { genres: ['Romance'] });
    const y = await liveComic(owner, { genres: ['Romance'] });
    // Nothing in common with x and y: only the other readers can bring it up.
    const z = await liveComic(owner, { genres: ['Horror'], types: 'manhwa', demographic: 'josei' });
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    for (const comic of [x, y]) for (const user of [a, b, c]) await follow(user, comic);
    for (const user of [b, c]) await follow(user, z);

    const res = await recommendations(a);
    expect(res.status).toBe(200);
    expect(ids(res)).not.toContain(x.id);
    expect(ids(res)).not.toContain(y.id);
    const item = res.body.data.find((comic) => comic.id === z.id);
    expect(item.reason).toEqual({ type: 'similar_readers', count: 2 });
    expect(item.score).toBeGreaterThan(0);

    // Following it changes the list right away (no stale cache).
    await follow(a, z);
    expect(ids(await recommendations(a))).not.toContain(z.id);
  });

  it('content-based: more of the genres the reader likes, with the comic it resembles', async () => {
    const owner = await createUser('contributor');
    const liked = [await liveComic(owner, { genres: ['Wuxia', 'Action'] }), await liveComic(owner, { genres: ['Wuxia'] })];
    const unread = await liveComic(owner, { genres: ['Wuxia', 'Action'] });
    const romance = await liveComic(owner, { genres: ['Romance'] });
    const reader = await createUser();
    for (const comic of liked) await follow(reader, comic);

    const list = ids(await recommendations(reader));
    expect(list).toContain(unread.id);
    if (list.includes(romance.id)) expect(list.indexOf(unread.id)).toBeLessThan(list.indexOf(romance.id));

    const item = (await recommendations(reader)).body.data.find((comic) => comic.id === unread.id);
    expect(item.reason.type).toBe('because_you_liked');
    expect(item.reason.comic).toEqual({ id: liked[0].id, url: liked[0].url, name: liked[0].url });
  });

  it('never recommends what the reader followed, read, disliked, cannot see or filtered out', async () => {
    const owner = await createUser('contributor');
    const isekai = (overrides = {}) => liveComic(owner, { genres: ['Isekai'], ...overrides });
    const [followed, read, disliked, hidden, erotica, fine] = [
      await isekai(), await isekai(), await isekai(), await isekai(), await isekai({ contentRating: 'erotica' }), await isekai(),
    ];
    await models.Comic.update({ visibility: 'hidden' }, { where: { id: hidden.id } });
    const chapter = await createChapter(owner, read.id);
    await approve({ chapterIds: [chapter.id] });

    const reader = await createUser();
    await follow(reader, followed);
    expect((await api().get(`/chapters/${chapter.id}`).set(auth(reader))).status).toBe(200);
    expect((await api().put(`/me/ratings/${disliked.id}`).set(auth(reader)).send({ rating: 2 })).status).toBe(200);

    const list = ids(await recommendations(reader));
    expect(list).toContain(fine.id);
    for (const comic of [followed, read, disliked, hidden, erotica]) expect(list).not.toContain(comic.id);

    // Raising the content filter lets erotica in.
    expect((await api().patch('/me/preferences').set(auth(reader)).send({ filter: 2 })).status).toBe(200);
    expect(ids(await recommendations(reader))).toContain(erotica.id);
  });
});

describe('GET /comics/:comicId/similar', () => {
  it('ranks by content similarity, ties to the most viewed, never the comic itself', async () => {
    const owner = await createUser('contributor');
    const mecha = (genres, overrides = {}) => liveComic(owner, { genres, types: 'manhua', demographic: 'seinen', ...overrides });
    const source = await mecha(['Mecha', 'Space']);
    const twin = await mecha(['Mecha', 'Space']);
    const popularTwin = await mecha(['Mecha', 'Space']);
    const half = await mecha(['Mecha']);
    const hiddenTwin = await mecha(['Mecha', 'Space']);
    const eroticTwin = await mecha(['Mecha', 'Space'], { contentRating: 'erotica' });
    const unrelated = await liveComic(owner, { genres: ['Cooking'] });
    await models.Comic.update({ view: 100 }, { where: { id: popularTwin.id } });
    await models.Comic.update({ visibility: 'hidden' }, { where: { id: hiddenTwin.id } });

    const res = await api().get(`/comics/${source.url}/similar?contentRating=safe,suggestive`);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([popularTwin.id, twin.id, half.id]);
    expect(res.body.data[0].similarity).toBeCloseTo(1);
    expect(res.body.data[2].similarity).toBeLessThan(1);
    expect(res.body.data[0]).toMatchObject({ url: popularTwin.url, genres: expect.arrayContaining(['Mecha', 'Space']) });

    expect(ids(await api().get(`/comics/${source.id}/similar`))).toContain(eroticTwin.id);
    expect(ids(await api().get(`/comics/${source.id}/similar?limit=1`))).toEqual([popularTwin.id]);
    expect(ids(await api().get(`/comics/${unrelated.id}/similar`))).not.toContain(source.id);
  });

  it('404 for a comic readers cannot see, 400 for a bad limit', async () => {
    const owner = await createUser('contributor');
    const pending = await createComic(owner);
    expect((await api().get(`/comics/${pending.id}/similar`)).status).toBe(404);
    const live = await liveComic(owner);
    expect((await api().get(`/comics/${live.id}/similar?limit=31`)).status).toBe(400);
    expect((await api().get(`/comics/${live.id}/similar?limit=abc`)).status).toBe(400);
  });
});
