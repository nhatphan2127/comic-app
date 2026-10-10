// View counting when a chapter is opened (comics.view, comic_daily_views, user_read_days).
import { describe, it, expect } from 'vitest';
import { api, models, createUser, createComic, createChapter, approve, auth } from './helpers.js';

const views = async (comicId) => (await models.Comic.findByPk(comicId, { raw: true })).view;
const dailyViews = (comicId) => models.ComicDailyView.findAll({ where: { comicId }, raw: true });
const readDays = (userId) => models.UserReadDay.findAll({ where: { userId }, raw: true });

async function readableChapter() {
  const owner = await createUser('contributor');
  const comic = await createComic(owner);
  const chapter = await createChapter(owner, comic.id);
  await approve({ comicId: comic.id, chapterIds: [chapter.id] });
  return { comic, chapter };
}

const today = () => new Date().toISOString().slice(0, 10);

describe('view counting', () => {
  it('a logged-in reader counts once per 30 minutes per chapter', async () => {
    const { comic, chapter } = await readableChapter();
    const reader = await createUser();

    expect((await api().get(`/chapters/${chapter.id}`).set(auth(reader))).status).toBe(200);
    expect((await api().get(`/chapters/${chapter.id}`).set(auth(reader))).status).toBe(200);
    expect(await views(comic.id)).toBe(1);

    // 31 minutes later (same UTC timestamp format as CURRENT_TIMESTAMP) the next open is a new view.
    const earlier = new Date(Date.now() - 31 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await models.ReadHistory.update({ readAt: earlier }, { where: { userId: reader.id, chapterId: chapter.id } });
    await api().get(`/chapters/${chapter.id}`).set(auth(reader));
    expect(await views(comic.id)).toBe(2);

    expect(await dailyViews(comic.id)).toEqual([{ comicId: comic.id, day: today(), views: 2 }]);
  });

  it('a chapter counts once per day in the reader\'s read days', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    const first = await createChapter(owner, comic.id, 1);
    const second = await createChapter(owner, comic.id, 2);
    await approve({ comicId: comic.id, chapterIds: [first.id, second.id] });
    const reader = await createUser();

    await api().get(`/chapters/${first.id}`).set(auth(reader));
    await api().get(`/chapters/${first.id}`).set(auth(reader));
    await api().get(`/chapters/${second.id}`).set(auth(reader));
    expect(await readDays(reader.id)).toEqual([{ userId: reader.id, day: today(), chapters: 2 }]);

    // Read yesterday: opening it again today is today's first read of it.
    await models.UserReadDay.destroy({ where: { userId: reader.id } });
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await models.ReadHistory.update({ readAt: yesterday }, { where: { userId: reader.id, chapterId: first.id } });
    await api().get(`/chapters/${first.id}`).set(auth(reader));
    expect((await readDays(reader.id))[0].chapters).toBe(1);
  });

  it('guests count on every open; unreadable chapters count nothing', async () => {
    const { comic, chapter } = await readableChapter();
    await api().get(`/chapters/${chapter.id}`);
    await api().get(`/chapters/${chapter.id}`);
    expect(await views(comic.id)).toBe(2);

    await models.Comic.update({ visibility: 'hidden' }, { where: { id: comic.id } });
    expect((await api().get(`/chapters/${chapter.id}`)).status).toBe(404);
    expect(await views(comic.id)).toBe(2);
  });
});
