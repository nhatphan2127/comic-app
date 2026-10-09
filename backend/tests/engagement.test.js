import { describe, it, expect } from 'vitest';
import { api, createUser, createComic, createChapter, approve, auth } from './helpers.js';
import { outbox } from '../src/utils/mailer.js';

const notificationsOf = async (user) => (await api().get('/me/notifications').set(auth(user))).body.data;

// Comics and chapters start as "pending"; a moderator makes them readable.
async function publishedComic(owner, moderator, overrides) {
  const comic = await createComic(owner, overrides);
  await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'accept' });
  return comic;
}

describe('notifications', () => {
  it('followers hear about an approved chapter, contributors about the decision', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const fan = await createUser();
    const comic = await publishedComic(owner, moderator);
    await api().put(`/me/following/${comic.id}`).set(auth(fan));

    const chapter = await createChapter(owner, comic.id, 7);
    expect(await notificationsOf(fan)).toEqual([]); // still pending

    await api().patch(`/moderation/chapters/${chapter.id}`).set(auth(moderator)).send({ status: 'accept' });
    const [news] = await notificationsOf(fan);
    expect(news).toMatchObject({ type: 'new_chapter', redirectPath: `/comics/${comic.url}/${chapter.id}` });
    expect(news.content).toContain('Chapter 7');

    const ownerTypes = (await notificationsOf(owner)).map((n) => n.type);
    expect(ownerTypes.filter((t) => t === 'system_review')).toHaveLength(2); // the comic and the chapter

    // Saving the same decision again is not news.
    await api().patch(`/moderation/chapters/${chapter.id}`).set(auth(moderator)).send({ status: 'accept' });
    expect(await notificationsOf(fan)).toHaveLength(1);
  });

  it('a reply notifies the parent author, but not when replying to yourself', async () => {
    const owner = await createUser('contributor');
    const alice = await createUser();
    const bob = await createUser();
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const root = await api().post(`/comics/${comic.id}/comments`).set(auth(alice)).send({ content: 'first' });

    await api().post(`/comics/${comic.id}/comments`).set(auth(alice)).send({ content: 'me again', parentCommentId: root.body.data.id });
    expect(await notificationsOf(alice)).toEqual([]);

    const reply = await api().post(`/comics/${comic.id}/comments`).set(auth(bob)).send({ content: 'hello alice', parentCommentId: root.body.data.id });
    const [n] = await notificationsOf(alice);
    expect(n).toMatchObject({ type: 'comment_reply', content: 'hello alice', redirectPath: `/comics/${comic.url}?cm_id=${reply.body.data.id}` });
  });
});

describe('reading progress', () => {
  it('comic detail says where the reader left off; following counts unread chapters', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const reader = await createUser();
    const comic = await publishedComic(owner, moderator);
    const chapters = [];
    for (const n of [1, 2, 3]) {
      const ch = await createChapter(owner, comic.id, n);
      await api().patch(`/moderation/chapters/${ch.id}`).set(auth(moderator)).send({ status: 'accept' });
      chapters.push(ch);
    }
    await api().put(`/me/following/${comic.id}`).set(auth(reader));

    expect((await api().get(`/comics/${comic.url}`).set(auth(reader))).body.data.progress).toBeNull();

    await api().get(`/chapters/${chapters[0].id}`).set(auth(reader));
    await api().put(`/me/history/${chapters[0].id}`).set(auth(reader)).send({ currentPage: 1 });
    const detail = (await api().get(`/comics/${comic.url}`).set(auth(reader))).body.data;
    expect(detail.progress).toEqual({ lastChapterId: chapters[0].id, lastPage: 1, readChapterIds: [chapters[0].id] });

    const [entry] = (await api().get('/me/following').set(auth(reader))).body.data;
    expect(entry).toMatchObject({ totalChapters: 3, unreadChapters: 2, readedChapter: 1 });
    expect(entry.lastReadAt).toBeTruthy();
  });
});

describe('catalogue search', () => {
  it('finds comics by author and filters by format', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const comic = await createComic(owner);
    // Set an author and a format through the edit form, then publish.
    await api()
      .patch(`/comics/${comic.id}`)
      .set(auth(owner))
      .field('name', comic.url)
      .field('types', 'manga')
      .field('demographic', 'shounen')
      .field('url', comic.url)
      .field('author', 'Zyx Unique Author')
      .field('formats', 'Long Strip');
    await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'accept' });

    const byAuthor = await api().get('/comics?q=unique author');
    expect(byAuthor.body.data.map((c) => c.id)).toEqual([comic.id]);
    const byFormat = await api().get('/comics?format=long strip');
    expect(byFormat.body.data.map((c) => c.id)).toContain(comic.id);
    expect((await api().get('/comics?format=oneshot')).body.data.map((c) => c.id)).not.toContain(comic.id);
  });
});

describe('ratings', () => {
  it('a rating can be taken back and the average follows', async () => {
    const owner = await createUser('contributor');
    const a = await createUser();
    const b = await createUser();
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    await api().put(`/me/ratings/${comic.id}`).set(auth(a)).send({ rating: 5 });
    await api().put(`/me/ratings/${comic.id}`).set(auth(b)).send({ rating: 1 });

    const res = await api().delete(`/me/ratings/${comic.id}`).set(auth(b));
    expect(res.body.data).toEqual({ comicId: comic.id, userRating: 0, averageRating: 5 });
    // Idempotent.
    expect((await api().delete(`/me/ratings/${comic.id}`).set(auth(b))).status).toBe(200);
  });
});

describe('reader actions only reach content readers can see', () => {
  it('unapproved content: nobody can follow, rate, comment or track it, staff included', async () => {
    const owner = await createUser('contributor');
    const moderator = await createUser('moderator');
    const admin = await createUser('admin');
    const reader = await createUser();
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);

    for (const user of [reader, owner, moderator, admin]) {
      expect((await api().put(`/me/following/${comic.id}`).set(auth(user))).status).toBe(404);
      expect((await api().put(`/me/ratings/${comic.id}`).set(auth(user)).send({ rating: 5 })).status).toBe(404);
      expect((await api().get(`/comics/${comic.id}/comments`).set(auth(user))).status).toBe(404);
      expect((await api().post(`/chapters/${chapter.id}/comments`).set(auth(user)).send({ content: 'hi' })).status).toBe(404);
      expect((await api().put(`/me/history/${chapter.id}`).set(auth(user)).send({ currentPage: 1 })).status).toBe(404);
    }

    await approve({ comicId: comic.id, chapterIds: [chapter.id] });
    expect((await api().put(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(201);
    expect((await api().post(`/chapters/${chapter.id}/comments`).set(auth(reader)).send({ content: 'hi' })).status).toBe(201);
    expect((await api().put(`/me/history/${chapter.id}`).set(auth(reader)).send({ currentPage: 1 })).status).toBe(200);
  });

  it('once hidden, follows, ratings, history and comments vanish from the profile and cannot be touched', async () => {
    const owner = await createUser('contributor');
    const admin = await createUser('admin');
    const reader = await createUser();
    const comic = await createComic(owner);
    const chapter = await createChapter(owner, comic.id);
    await approve({ comicId: comic.id, chapterIds: [chapter.id] });

    await api().put(`/me/following/${comic.id}`).set(auth(reader));
    await api().put(`/me/ratings/${comic.id}`).set(auth(reader)).send({ rating: 4 });
    await api().get(`/chapters/${chapter.id}`).set(auth(reader));
    const comment = await api().post(`/comics/${comic.id}/comments`).set(auth(reader)).send({ content: 'nice' });
    const commentId = comment.body.data.id;
    expect((await api().get('/me').set(auth(reader))).body.data.stats).toMatchObject({ following: 1, comments: 1 });

    expect((await api().patch(`/admin/comics/${comic.id}`).set(auth(admin)).send({ visibility: 'hidden' })).status).toBe(200);

    // Gone from every list and counter...
    expect((await api().get('/me').set(auth(reader))).body.data.stats).toMatchObject({ following: 0, comments: 0 });
    expect((await api().get('/me/following').set(auth(reader))).body.data).toHaveLength(0);
    expect((await api().get('/me/history').set(auth(reader))).body.meta.totalItems).toBe(0);
    expect((await api().get('/me/comments').set(auth(reader))).body.meta.totalItems).toBe(0);
    expect((await api().get(`/users/${reader.id}/comments`)).body.meta.totalItems).toBe(0);

    // ...and out of reach, removal included.
    expect((await api().delete(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(404);
    expect((await api().get(`/me/following/${comic.id}`).set(auth(reader))).status).toBe(404);
    expect((await api().delete(`/me/ratings/${comic.id}`).set(auth(reader))).status).toBe(404);
    expect((await api().delete(`/me/history/${chapter.id}`).set(auth(reader))).status).toBe(404);
    expect((await api().patch(`/comments/${commentId}`).set(auth(reader)).send({ content: 'edit' })).status).toBe(404);
    expect((await api().delete(`/comments/${commentId}`).set(auth(reader))).status).toBe(404);
    expect((await api().put(`/comments/${commentId}/reaction`).set(auth(owner)).send({ type: 'like' })).status).toBe(404);
    expect((await api().post('/reports').set(auth(owner)).send({ targetType: 'comic', targetId: comic.id, reason: 'x' })).status).toBe(404);
    // Clearing history leaves the hidden entry alone.
    expect((await api().delete('/me/history').set(auth(reader))).status).toBe(204);

    // Nothing was lost: showing the comic again brings everything back.
    await api().patch(`/admin/comics/${comic.id}`).set(auth(admin)).send({ visibility: 'public' });
    expect((await api().get('/me').set(auth(reader))).body.data.stats).toMatchObject({ following: 1, comments: 1 });
    expect((await api().get('/me/history').set(auth(reader))).body.meta.totalItems).toBe(1);
    expect((await api().get(`/comics/${comic.id}`).set(auth(reader))).body.data.userRating).toBe(4);
  });
});

describe('public profiles', () => {
  it('shows public fields and visible comments, never private data', async () => {
    const owner = await createUser('contributor');
    const admin = await createUser('admin');
    const user = await createUser();
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const kept = await api().post(`/comics/${comic.id}/comments`).set(auth(user)).send({ content: 'visible' });
    const banned = await api().post(`/comics/${comic.id}/comments`).set(auth(user)).send({ content: 'bad' });
    await api().patch(`/admin/comments/${banned.body.data.id}`).set(auth(admin)).send({ isBanned: true });

    const profile = await api().get(`/users/${user.id}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.username).toBe(user.userName);
    expect(profile.body.data).not.toHaveProperty('email');
    expect(profile.body.data.stats.comments).toBe(1); // the banned one is hidden

    const comments = await api().get(`/users/${user.id}/comments`);
    expect(comments.body.data.map((c) => c.id)).toEqual([kept.body.data.id]);

    await api().patch(`/admin/users/${user.id}`).set(auth(admin)).send({ isBanned: true });
    expect((await api().get(`/users/${user.id}`)).status).toBe(404);
  });
});

describe('preferences', () => {
  it('stores theme, content filter and reader settings, validating each', async () => {
    const user = await createUser();
    expect((await api().get('/me').set(auth(user))).body.data.preference).toMatchObject({ theme: 'main', filter: 1, reader: null });

    expect((await api().patch('/me/preferences').set(auth(user)).send({ theme: 'neon' })).status).toBe(400);
    expect((await api().patch('/me/preferences').set(auth(user)).send({ filter: 9 })).status).toBe(400);
    expect((await api().patch('/me/preferences').set(auth(user)).send({ reader: 'x' })).status).toBe(400);

    await api().patch('/me/preferences').set(auth(user)).send({ theme: 'dark', reader: { width: 80 } });
    const res = await api().patch('/me/preferences').set(auth(user)).send({ filter: 0 });
    expect(res.body.data).toEqual({ theme: 'dark', filter: 0, reader: { width: 80 } });
  });
});

describe('password reset', () => {
  const lastLink = () => outbox.at(-1).text.match(/token=([a-f0-9]+)/)[1];

  it('emails a one-time link that sets a new password and ends every session', async () => {
    const user = await createUser();
    const email = `${user.userName}@test.dev`;

    const before = outbox.length;
    expect((await api().post('/auth/password-reset').send({ email: 'nobody@test.dev' })).status).toBe(204);
    expect(outbox.length).toBe(before); // unknown email: same answer, no mail

    expect((await api().post('/auth/password-reset').send({ email })).status).toBe(204);
    const token = lastLink();

    const mismatch = await api().post('/auth/password-reset/confirm').send({ token, newPassword: 'newpass1', confirmPassword: 'other' });
    expect(mismatch.status).toBe(400);
    const done = await api().post('/auth/password-reset/confirm').send({ token, newPassword: 'newpass1', confirmPassword: 'newpass1' });
    expect(done.status).toBe(204);

    expect((await api().get('/me').set(auth(user))).status).toBe(401); // old session is gone
    expect((await api().post('/auth/login').send({ userName: user.userName, password: user.password })).status).toBe(401);
    expect((await api().post('/auth/login').send({ userName: user.userName, password: 'newpass1' })).status).toBe(200);

    // The link works once.
    const again = await api().post('/auth/password-reset/confirm').send({ token, newPassword: 'another1', confirmPassword: 'another1' });
    expect(again.status).toBe(400);
  });

  it('a newer link replaces the older one', async () => {
    const user = await createUser();
    const email = `${user.userName}@test.dev`;
    await api().post('/auth/password-reset').send({ email });
    const first = lastLink();
    await api().post('/auth/password-reset').send({ email });

    const old = await api().post('/auth/password-reset/confirm').send({ token: first, newPassword: 'newpass1', confirmPassword: 'newpass1' });
    expect(old.status).toBe(400);
  });
});
