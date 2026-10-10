import { describe, it, expect, beforeAll } from 'vitest';
import { api, createUser, createComic, createChapter, approve, auth, models } from './helpers.js';

describe('blocking users: /me/blocks', () => {
  let me;
  let other;

  beforeAll(async () => {
    me = await createUser();
    other = await createUser();
  });

  it('needs a login', async () => {
    expect((await api().get('/me/blocks')).status).toBe(401);
    expect((await api().put(`/me/blocks/${other.id}`)).status).toBe(401);
  });

  it('cannot block yourself (400) or an unknown user (404)', async () => {
    expect((await api().put(`/me/blocks/${me.id}`).set(auth(me))).status).toBe(400);
    expect((await api().put('/me/blocks/no-such-user').set(auth(me))).status).toBe(404);
    expect((await api().delete('/me/blocks/no-such-user').set(auth(me))).status).toBe(404);
  });

  it('blocks idempotently, lists with the profile basics, and unblocks', async () => {
    const third = await createUser();
    expect((await api().put(`/me/blocks/${other.id}`).set(auth(me))).status).toBe(204);
    expect((await api().put(`/me/blocks/${other.id}`).set(auth(me))).status).toBe(204);
    expect((await api().put(`/me/blocks/${third.id}`).set(auth(me))).status).toBe(204);
    // Different timestamps so "most recent first" is decided by the date, not the id tiebreak.
    await models.UserBlock.update({ createdAt: '2020-01-01 00:00:00' }, { where: { blockerId: me.id, blockedId: other.id } });

    const list = await api().get('/me/blocks?pageSize=1').set(auth(me));
    expect(list.status).toBe(200);
    expect(list.body.meta).toEqual({ page: 1, pageSize: 1, totalItems: 2, totalPages: 2 });
    expect(list.body.data[0]).toMatchObject({ id: third.id, username: third.userName, displayName: third.userName });
    expect(list.body.data[0]).toHaveProperty('avatar');
    expect(list.body.data[0]).toHaveProperty('blockedAt');

    expect((await api().delete(`/me/blocks/${third.id}`).set(auth(me))).status).toBe(204);
    expect((await api().delete(`/me/blocks/${third.id}`).set(auth(me))).status).toBe(204);
    const after = await api().get('/me/blocks').set(auth(me));
    expect(after.body.data.map((u) => u.id)).toEqual([other.id]);

    // Someone else's list is their own.
    expect((await api().get('/me/blocks').set(auth(other))).body.data).toEqual([]);
    await api().delete(`/me/blocks/${other.id}`).set(auth(me));
  });

  it('public profiles stay reachable and say whether the viewer blocked them', async () => {
    await api().put(`/me/blocks/${other.id}`).set(auth(me));
    const mine = await api().get(`/users/${other.id}`).set(auth(me));
    expect(mine.status).toBe(200);
    expect(mine.body.data.isBlocked).toBe(true);
    expect((await api().get(`/users/${other.id}`)).body.data.isBlocked).toBe(false);
    expect((await api().get(`/users/${other.id}`).set(auth(other))).body.data.isBlocked).toBe(false);

    await api().delete(`/me/blocks/${other.id}`).set(auth(me));
    expect((await api().get(`/users/${other.id}`).set(auth(me))).body.data.isBlocked).toBe(false);
  });
});

// Hiding works the same for comic and chapter comments (one repository serves both).
describe.each(['comics', 'chapters'])('blocked users in %s comments', (kind) => {
  let blocker;
  let blocked;
  let bystander;
  let targetId;
  let blockedRoot; // blocked's root comment, with a reply by bystander under it
  let replyUnderBlocked;
  let bystanderRoot; // bystander's root comment, with a reply by blocked and a reply to that one
  let blockedReply;
  let replyToBlockedReply;
  let keptReply;

  const post = (user, content, parentCommentId) =>
    api().post(`/${kind}/${targetId}/comments`).set(auth(user)).send({ content, parentCommentId });
  const list = (user) => {
    const req = api().get(`/${kind}/${targetId}/comments?pageSize=50`);
    return user ? req.set(auth(user)) : req;
  };
  // Every comment id in a tree, at any depth.
  const ids = (nodes) => (nodes ?? []).flatMap((n) => [n.id, ...ids(n.childComment)]);

  beforeAll(async () => {
    const owner = await createUser('contributor');
    [blocker, blocked, bystander] = [await createUser(), await createUser(), await createUser()];
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    targetId = kind === 'comics' ? comic.id : (await createChapter(owner, comic.id)).id;
    if (kind === 'chapters') await approve({ chapterIds: [targetId] });

    blockedRoot = (await post(blocked, 'from blocked')).body.data.id;
    replyUnderBlocked = (await post(bystander, 'reply under blocked', blockedRoot)).body.data.id;
    bystanderRoot = (await post(bystander, 'from bystander')).body.data.id;
    blockedReply = (await post(blocked, 'blocked replies', bystanderRoot)).body.data.id;
    replyToBlockedReply = (await post(blocker, 'answering blocked', blockedReply)).body.data.id;
    keptReply = (await post(blocker, 'kept reply', bystanderRoot)).body.data.id;

    await api().put(`/me/blocks/${blocked.id}`).set(auth(blocker));
  });

  it('hides the blocked user\'s comments and the branches under them from the blocker only', async () => {
    const mine = await list(blocker);
    expect(mine.status).toBe(200);
    expect(ids(mine.body.data).sort()).toEqual([bystanderRoot, keptReply].sort());
    expect(mine.body.meta.totalItems).toBe(1);

    const everyone = [blockedRoot, replyUnderBlocked, bystanderRoot, blockedReply, replyToBlockedReply, keptReply].sort();
    for (const viewer of [bystander, blocked, null]) {
      const res = await list(viewer);
      expect(ids(res.body.data).sort()).toEqual(everyone);
      expect(res.body.meta.totalItems).toBe(2);
    }
  });

  it('pages over the roots the blocker sees, so the total matches', async () => {
    const page1 = await api().get(`/${kind}/${targetId}/comments?pageSize=1&sort=createdAt`).set(auth(blocker));
    expect(page1.body.meta).toEqual({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
    expect(page1.body.data.map((c) => c.id)).toEqual([bystanderRoot]);
  });

  it('a single comment hides blocked replies and is a 404 when the blocked user wrote it', async () => {
    const thread = await api().get(`/comments/${bystanderRoot}`).set(auth(blocker));
    expect(thread.status).toBe(200);
    expect(ids(thread.body.data.childComment)).toEqual([keptReply]);

    expect((await api().get(`/comments/${blockedRoot}`).set(auth(blocker))).status).toBe(404);
    expect((await api().get(`/comments/${blockedRoot}`).set(auth(bystander))).status).toBe(200);
    expect((await api().get(`/comments/${blockedRoot}`)).status).toBe(200);
  });

  it('shows everything again after unblocking', async () => {
    await api().delete(`/me/blocks/${blocked.id}`).set(auth(blocker));
    const res = await list(blocker);
    expect(ids(res.body.data)).toContain(blockedRoot);
    expect(ids(res.body.data)).toContain(replyToBlockedReply);
    expect(res.body.meta.totalItems).toBe(2);
    await api().put(`/me/blocks/${blocked.id}`).set(auth(blocker));
  });
});

describe('reply notifications from blocked users', () => {
  it('are not sent to the blocker, and come back after unblocking', async () => {
    const owner = await createUser('contributor');
    const [blocker, blocked, bystander] = [await createUser(), await createUser(), await createUser()];
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const post = (user, content, parentCommentId) =>
      api().post(`/comics/${comic.id}/comments`).set(auth(user)).send({ content, parentCommentId });
    const replies = async () =>
      (await api().get('/me/notifications').set(auth(blocker))).body.data.filter((n) => n.type === 'comment_reply');

    const root = (await post(blocker, 'my comment')).body.data.id;
    await api().put(`/me/blocks/${blocked.id}`).set(auth(blocker));

    expect((await post(blocked, 'blocked reply', root)).status).toBe(201);
    expect(await replies()).toHaveLength(0);

    await post(bystander, 'bystander reply', root);
    expect(await replies()).toHaveLength(1);

    await api().delete(`/me/blocks/${blocked.id}`).set(auth(blocker));
    await post(blocked, 'reply after unblock', root);
    expect(await replies()).toHaveLength(2);
  });

  it('only the blocker is affected: the blocked user still gets replies from the blocker', async () => {
    const owner = await createUser('contributor');
    const [blocker, blocked] = [await createUser(), await createUser()];
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    await api().put(`/me/blocks/${blocked.id}`).set(auth(blocker));

    const root = (await api().post(`/comics/${comic.id}/comments`).set(auth(blocked)).send({ content: 'hi' })).body.data.id;
    await api().post(`/comics/${comic.id}/comments`).set(auth(blocker)).send({ content: 'hello', parentCommentId: root });
    const notes = (await api().get('/me/notifications').set(auth(blocked))).body.data;
    expect(notes.filter((n) => n.type === 'comment_reply')).toHaveLength(1);
  });
});

describe('moderation ignores blocks', () => {
  it('a moderator who blocked someone can still remove their comments', async () => {
    const owner = await createUser('contributor');
    const [moderator, blocked] = [await createUser('moderator'), await createUser()];
    const comic = await createComic(owner);
    await approve({ comicId: comic.id });
    const id = (await api().post(`/comics/${comic.id}/comments`).set(auth(blocked)).send({ content: 'spam' })).body.data.id;
    await api().put(`/me/blocks/${blocked.id}`).set(auth(moderator));

    expect((await api().delete(`/moderation/comments/${id}`).set(auth(moderator))).status).toBe(204);
  });
});
