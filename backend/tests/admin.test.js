import { describe, it, expect } from 'vitest';
import { api, models, createUser, createComic, createChapter, approve, auth } from './helpers.js';

describe('admin & moderation', () => {
  it('admin routes reject non-admins', async () => {
    const moderator = await createUser('moderator');
    expect((await api().get('/admin/dashboard')).status).toBe(401);
    expect((await api().get('/admin/dashboard').set(auth(moderator))).status).toBe(403);
  });

  it('dashboard returns pending items and comments of both kinds', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);
    // Comments only go on approved content, so they live on another comic.
    const live = await createComic(owner);
    const liveChapter = await createChapter(owner, live.id);
    await approve({ comicId: live.id, chapterIds: [liveChapter.id] });
    await api().post(`/comics/${live.id}/comments`).set(auth(owner)).send({ content: 'a' });
    await api().post(`/chapters/${liveChapter.id}/comments`).set(auth(owner)).send({ content: 'b' });

    const res = await api().get('/admin/dashboard').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.comics.map((c) => c.id)).toContain(comic.id);
    expect(res.body.data.chapters.map((c) => c.id)).toContain(chapter.id);
    expect(new Set(res.body.data.comments.map((c) => c.source))).toEqual(new Set(['comic', 'chapter']));
  });

  it('hiding a comic removes it from the public catalogue', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('contributor');
    const comic = await createComic(owner);

    expect((await api().patch(`/admin/comics/${comic.id}`).set(auth(admin)).send({ visibility: 'nope' })).status).toBe(400);
    const res = await api().patch(`/admin/comics/${comic.id}`).set(auth(admin)).send({ visibility: 'hidden' });
    expect(res.body.data).toEqual({ id: comic.id, visibility: 'hidden' });
    expect((await api().get(`/comics/${comic.url}`)).status).toBe(404);

    const hidden = await api().get('/admin/comics?visibility=hidden').set(auth(admin));
    expect(hidden.body.data.map((c) => c.id)).toContain(comic.id);
    expect(hidden.body.meta.totalItems).toBeGreaterThanOrEqual(1);
  });

  it('settings: GET and PATCH; auto-accept makes new comics skip the queue', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('contributor');
    expect((await api().get('/admin/settings').set(auth(admin))).body.data).toEqual({ autoAccept: false });
    expect((await api().patch('/admin/settings').set(auth(admin)).send({ autoAccept: 'yes' })).status).toBe(400);

    const on = await api().patch('/admin/settings').set(auth(admin)).send({ autoAccept: true });
    expect(on.body.data).toEqual({ autoAccept: true });
    const comic = await createComic(owner);
    expect((await models.Comic.findByPk(comic.id, { raw: true })).status).toBe('accept');
    await api().patch('/admin/settings').set(auth(admin)).send({ autoAccept: false });
  });

  it('reviewing a chapter updates the chapter and its contributors together', async () => {
    const moderator = await createUser('moderator');
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);

    const res = await api().patch(`/moderation/chapters/${chapter.id}`).set(auth(moderator)).send({ status: 'reject' });
    expect(res.body.data).toEqual({ id: chapter.id, status: 'reject' });
    const contributor = await models.ChapterContributor.findOne({ where: { chapterId: chapter.id }, raw: true });
    expect(contributor.status).toBe('reject');

    expect((await api().patch('/moderation/chapters/missing').set(auth(moderator)).send({ status: 'accept' })).status).toBe(404);
  });

  it('moderation lists filter by status and validate it', async () => {
    const moderator = await createUser('moderator');
    const owner = await createUser('contributor');
    const comic = await createComic(owner);

    const pending = await api().get('/moderation/comics?status=pending').set(auth(moderator));
    expect(pending.body.data.map((c) => c.id)).toContain(comic.id);
    expect((await api().get('/moderation/comics?status=approved').set(auth(moderator))).status).toBe(400);

    const queue = await api().get('/moderation/queue?comicStatus=pending').set(auth(moderator));
    expect(queue.body.data.comics.map((c) => c.id)).toContain(comic.id);
  });

  it('admin can ban a comment by id', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const c = await api().post(`/comics/${comic.id}/comments`).set(auth(owner)).send({ content: 'x' });

    const res = await api().patch(`/admin/comments/${c.body.data.id}`).set(auth(admin)).send({ isBanned: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: c.body.data.id, type: 'comic', isBanned: true });
    expect((await models.ComicComment.findByPk(c.body.data.id, { raw: true })).isBanned).toBe(1);

    expect((await api().patch(`/admin/comments/${c.body.data.id}`).set(auth(admin)).send({ isBanned: 'yes' })).status).toBe(400);
  });

  it('users only see and change their own notifications', async () => {
    const alice = await createUser();
    const bob = await createUser();
    await models.Notification.create({ id: 'n1', userId: alice.id, title: 't', content: 'c', type: 'info' });

    expect((await api().get('/me/notifications').set(auth(bob))).body.meta.totalItems).toBe(0);
    expect((await api().patch('/me/notifications/n1').set(auth(bob)).send({ isRead: true })).status).toBe(404);
    expect((await models.Notification.findByPk('n1', { raw: true })).isRead).toBe(0);

    const res = await api().patch('/me/notifications/n1').set(auth(alice)).send({ isRead: true });
    expect(res.body.data).toMatchObject({ id: 'n1', isRead: 1 });
    expect((await api().get('/me/notifications?isRead=false').set(auth(alice))).body.meta.totalItems).toBe(0);
    expect((await api().get('/me/notifications?isRead=maybe').set(auth(alice))).status).toBe(400);
  });
});
