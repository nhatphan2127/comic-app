import { describe, it, expect } from 'vitest';
import { api, createUser, createComic, createChapter, auth, models } from './helpers.js';

const REASON = 'I translate manga and want to upload chapters here.';

describe('contributor requests', () => {
  it('a reader asks, withdraws, asks again and an admin approves', async () => {
    const reader = await createUser();
    const admin = await createUser('admin');

    const empty = await api().get('/me/role-request').set(auth(reader));
    expect(empty.body.data).toEqual({ request: null, canRequest: true, retryAfterDays: 0 });

    expect((await api().post('/me/role-request').set(auth(reader)).send({ reason: 'too short' })).status).toBe(400);
    const sent = await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON, portfolio: 'https://example.dev' });
    expect(sent.status).toBe(201);
    expect(sent.body.data.status).toBe('pending');
    // One pending request at a time.
    expect((await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON })).status).toBe(409);

    const pending = await api().get('/me/role-request').set(auth(reader));
    expect(pending.body.data.canRequest).toBe(false);

    expect((await api().delete('/me/role-request').set(auth(reader))).status).toBe(204);
    expect((await api().delete('/me/role-request').set(auth(reader))).status).toBe(404);

    const again = await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON });
    expect(again.status).toBe(201);

    expect((await api().get('/admin/role-requests').set(auth(reader))).status).toBe(403);
    const list = await api().get('/admin/role-requests?status=pending').set(auth(admin));
    const item = list.body.data.find((r) => r.id === again.body.data.id);
    expect(item.user.username).toBe(reader.userName);

    expect((await api().patch(`/admin/role-requests/${item.id}`).set(auth(admin)).send({ status: 'pending' })).status).toBe(400);
    const approved = await api().patch(`/admin/role-requests/${item.id}`).set(auth(admin)).send({ status: 'approved' });
    expect(approved.body.data.status).toBe('approved');
    expect((await api().patch(`/admin/role-requests/${item.id}`).set(auth(admin)).send({ status: 'rejected' })).status).toBe(409);

    const me = await api().get('/me').set(auth(reader));
    expect(me.body.data.role).toBe('contributor');
    const notes = await api().get('/me/notifications').set(auth(reader));
    expect(notes.body.data.some((n) => n.type === 'system_role_request' && n.redirectPath === '/studio')).toBe(true);

    // Contributors cannot ask again.
    expect((await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON })).status).toBe(403);
  });

  it('a rejected reader waits before asking again', async () => {
    const reader = await createUser();
    const admin = await createUser('admin');
    const sent = await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON });
    await api().patch(`/admin/role-requests/${sent.body.data.id}`).set(auth(admin)).send({ status: 'rejected', note: 'Show us some work first.' });

    const state = await api().get('/me/role-request').set(auth(reader));
    expect(state.body.data.request.reviewNote).toBe('Show us some work first.');
    expect(state.body.data.canRequest).toBe(false);
    expect(state.body.data.retryAfterDays).toBe(7);
    expect((await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON })).status).toBe(409);

    await models.RoleRequest.update({ updatedAt: '2000-01-01 00:00:00' }, { where: { id: sent.body.data.id } });
    expect((await api().post('/me/role-request').set(auth(reader)).send({ reason: REASON })).status).toBe(201);
  });
});

describe('admin users', () => {
  it('lists, searches and filters accounts', async () => {
    const admin = await createUser('admin');
    const mod = await createUser('moderator');

    expect((await api().get('/admin/users').set(auth(mod))).status).toBe(403);
    const found = await api().get(`/admin/users?q=${mod.userName}`).set(auth(admin));
    expect(found.body.data.map((u) => u.id)).toEqual([mod.id]);
    const mods = await api().get('/admin/users?role=moderator&pageSize=100').set(auth(admin));
    expect(mods.body.data.every((u) => u.role === 'moderator')).toBe(true);
    expect((await api().get('/admin/users?role=king').set(auth(admin))).status).toBe(400);

    const dashboard = await api().get('/admin/dashboard').set(auth(admin));
    expect(dashboard.body.data.totals.users).toBeGreaterThan(1);
  });
});

describe('staff content search', () => {
  it('filters comics by name and chapters by title or comic name', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('contributor');
    const comic = await createComic(owner, { name: 'Zebra Quest Unique' });
    const chapter = await createChapter(owner, comic.id);

    const comics = await api().get('/admin/comics?q=zebra quest unique').set(auth(admin));
    expect(comics.body.data.map((c) => c.id)).toEqual([comic.id]);

    const chapters = await api().get('/admin/chapters?q=Zebra Quest Unique').set(auth(admin));
    expect(chapters.body.data.map((c) => c.id)).toEqual([chapter.id]);
    expect(chapters.body.data[0].comicName).toBe('Zebra Quest Unique');
    expect((await api().get('/moderation/chapters?sort=-chapterNumber').set(auth(admin))).status).toBe(200);
  });
});
