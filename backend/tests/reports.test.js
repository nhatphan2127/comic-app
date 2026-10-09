import { describe, it, expect } from 'vitest';
import { api, createUser, createComic, createChapter, approve, auth } from './helpers.js';

describe('reports', () => {
  it('readers report comics and comments; moderators list and resolve them', async () => {
    const owner = await createUser('contributor');
    const reader = await createUser();
    const moderator = await createUser('moderator');
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const chapter = await createChapter(owner, comic.id);
    await approve({ chapterIds: [chapter.id] });
    const comment = await api().post(`/chapters/${chapter.id}/comments`).set(auth(owner)).send({ content: 'spam spam' });

    expect((await api().post('/reports').send({ targetType: 'comic', targetId: comic.id, reason: 'x' })).status).toBe(401);
    expect((await api().post('/reports').set(auth(reader)).send({ targetType: 'user', targetId: comic.id, reason: 'x' })).status).toBe(400);
    expect((await api().post('/reports').set(auth(reader)).send({ targetType: 'comic', targetId: comic.id })).status).toBe(400);
    expect((await api().post('/reports').set(auth(reader)).send({ targetType: 'comic', targetId: 'missing', reason: 'x' })).status).toBe(404);

    const filed = await api().post('/reports').set(auth(reader)).send({ targetType: 'comic', targetId: comic.id, reason: 'Wrong cover' });
    expect(filed.status).toBe(201);
    expect(filed.headers.location).toBe(`/api/v1/moderation/reports/${filed.body.data.id}`);
    // A second open report on the same target by the same reader is refused.
    expect((await api().post('/reports').set(auth(reader)).send({ targetType: 'comic', targetId: comic.id, reason: 'Again' })).status).toBe(409);

    const onComment = await api()
      .post('/reports')
      .set(auth(reader))
      .send({ targetType: 'comment', targetId: comment.body.data.id, reason: 'Spam', details: 'link farm' });
    expect(onComment.status).toBe(201);

    expect((await api().get('/moderation/reports').set(auth(reader))).status).toBe(403);
    const open = await api().get('/moderation/reports?status=open').set(auth(moderator));
    expect(open.status).toBe(200);
    const byTarget = Object.fromEntries(open.body.data.map((r) => [r.target.type, r]));
    expect(byTarget.comic.target.path).toBe(`/comics/${comic.url}`);
    expect(byTarget.comment.target.content).toBe('spam spam');
    expect(byTarget.comment.target.path).toBe(`/comics/${comic.url}/${chapter.id}?cm_id=${comment.body.data.id}`);
    expect(byTarget.comment.reporter.username).toBe(reader.userName);

    expect((await api().patch(`/moderation/reports/${filed.body.data.id}`).set(auth(moderator)).send({ status: 'nope' })).status).toBe(400);
    const resolved = await api().patch(`/moderation/reports/${filed.body.data.id}`).set(auth(moderator)).send({ status: 'resolved' });
    expect(resolved.body.data).toEqual({ id: filed.body.data.id, status: 'resolved' });

    const stillOpen = await api().get('/moderation/reports?status=open').set(auth(moderator));
    expect(stillOpen.body.data.map((r) => r.id)).not.toContain(filed.body.data.id);
    // Once resolved, the reader may report the comic again.
    expect((await api().post('/reports').set(auth(reader)).send({ targetType: 'comic', targetId: comic.id, reason: 'Again' })).status).toBe(201);
  });
});

describe('profile stats', () => {
  it('GET /me counts follows, folders, comments and likes received', async () => {
    const owner = await createUser('contributor');
    const fan = await createUser();
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    await api().put(`/me/following/${comic.id}`).set(auth(owner));
    await api().post('/me/following-categories').set(auth(owner)).send({ category: 'Later' });
    const comment = await api().post(`/comics/${comic.id}/comments`).set(auth(owner)).send({ content: 'hi' });
    await api().put(`/comments/${comment.body.data.id}/reaction`).set(auth(fan)).send({ type: 'like' });

    const me = await api().get('/me').set(auth(owner));
    expect(me.body.data.stats).toEqual({ following: 1, collections: 1, comments: 1, likes: 1 });
  });
});
