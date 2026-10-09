import { describe, it, expect, beforeAll } from 'vitest';
import { api, createUser, createComic, createChapter, approve, auth, PREFIX } from './helpers.js';

// Comic comments and chapter comments must behave identically, so the same suite runs for both.
describe.each(['comics', 'chapters'])('comments on %s', (kind) => {
  let author;
  let other;
  let targetId;

  beforeAll(async () => {
    const owner = await createUser('contributor');
    author = await createUser();
    other = await createUser();
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    targetId = kind === 'comics' ? comic.id : (await createChapter(owner, comic.id)).id;
    if (kind === 'chapters') await approve({ chapterIds: [targetId] });
  });

  const post = (user, body) => api().post(`/${kind}/${targetId}/comments`).set(auth(user)).send(body);

  it('validates content and target', async () => {
    expect((await post(author, { content: '   ' })).status).toBe(400);
    const missing = await api().post(`/${kind}/unknown-id/comments`).set(auth(author)).send({ content: 'hi' });
    expect(missing.status).toBe(404);
    expect((await api().get(`/${kind}/unknown-id/comments`)).status).toBe(404);
  });

  it('posts a comment (201 + Location) and a reply, and lists them as a tree', async () => {
    const root = await post(author, { content: 'root' });
    expect(root.status).toBe(201);
    expect(root.headers.location).toBe(`${PREFIX}/comments/${root.body.data.id}`);
    const reply = await post(other, { content: 'reply', parentCommentId: root.body.data.id });
    expect(reply.status).toBe(201);

    const list = await api().get(`/${kind}/${targetId}/comments`);
    expect(list.status).toBe(200);
    const node = list.body.data.find((c) => c.id === root.body.data.id);
    expect(node.childComment[0].content).toBe('reply');
    expect(list.body.meta.totalItems).toBeGreaterThanOrEqual(1);

    const detail = await api().get(`/comments/${root.body.data.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.type).toBe(kind === 'comics' ? 'comic' : 'chapter');
  });

  it('pages and sorts root comments in the database', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const id = kind === 'comics' ? comic.id : (await createChapter(owner, comic.id)).id;
    if (kind === 'chapters') await approve({ chapterIds: [id] });
    for (const content of ['first', 'second', 'third']) {
      await api().post(`/${kind}/${id}/comments`).set(auth(author)).send({ content });
    }

    const oldest = await api().get(`/${kind}/${id}/comments?sort=createdAt&pageSize=2`);
    expect(oldest.body.meta).toEqual({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(oldest.body.data).toHaveLength(2);
    expect((await api().get(`/${kind}/${id}/comments?sort=createdAt&pageSize=2&page=2`)).body.data).toHaveLength(1);

    expect((await api().get(`/${kind}/${id}/comments?sort=likes`)).status).toBe(400);
  });

  it('cannot edit or delete a comment written by someone else', async () => {
    const c = await post(author, { content: 'mine' });
    const id = c.body.data.id;
    expect((await api().patch(`/comments/${id}`).set(auth(other)).send({ content: 'x' })).status).toBe(403);
    expect((await api().delete(`/comments/${id}`).set(auth(other))).status).toBe(403);

    expect((await api().patch(`/comments/${id}`).set(auth(author)).send({ content: 'edited' })).status).toBe(200);
    expect((await api().delete(`/comments/${id}`).set(auth(author))).status).toBe(204);
    expect((await api().delete('/comments/missing').set(auth(author))).status).toBe(404);
  });

  it('PUT /reaction is idempotent and keeps like/dislike counters in sync', async () => {
    const c = await post(author, { content: 'react to me' });
    const id = c.body.data.id;
    const react = (type) => api().put(`/comments/${id}/reaction`).set(auth(other)).send({ type });

    expect((await react('love')).status).toBe(400);

    let res = await react('like');
    expect(res.body.data).toMatchObject({ likes: 1, dislikes: 0, userReaction: 'like' });

    res = await react('like'); // the same PUT again changes nothing
    expect(res.body.data).toMatchObject({ likes: 1, dislikes: 0, userReaction: 'like' });

    res = await react('dislike');
    expect(res.body.data).toMatchObject({ likes: 0, dislikes: 1, userReaction: 'dislike' });

    expect((await api().delete(`/comments/${id}/reaction`).set(auth(other))).status).toBe(204);

    const detail = await api().get(`/comments/${id}`);
    expect(detail.body.data.like).toBe(0);
    expect(detail.body.data.dislike).toBe(0);
  });

  it('a moderator can force-delete a comment', async () => {
    const moderator = await createUser('moderator');
    const c = await post(author, { content: 'bad words' });
    const res = await api().delete(`/moderation/comments/${c.body.data.id}`).set(auth(moderator));
    expect(res.status).toBe(204);
  });
});

describe('GET /me/comments', () => {
  it('lists my comments of both kinds, paginated and sortable', async () => {
    const owner = await createUser('contributor');
    const me = await createUser();
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const chapter = await createChapter(owner, comic.id);
    await approve({ chapterIds: [chapter.id] });
    await api().post(`/comics/${comic.id}/comments`).set(auth(me)).send({ content: 'on comic' });
    await api().post(`/chapters/${chapter.id}/comments`).set(auth(me)).send({ content: 'on chapter' });

    const res = await api().get('/me/comments?sort=-createdAt&pageSize=1').set(auth(me));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.totalItems).toBe(2);
    expect((await api().get('/me/comments?sort=password').set(auth(me))).status).toBe(400);
  });
});
