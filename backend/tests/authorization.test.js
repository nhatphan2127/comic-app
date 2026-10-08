import { describe, it, expect } from 'vitest';
import { api, createUser, createComic, auth } from './helpers.js';

describe('authorization (broken access control)', () => {
  it('a contributor cannot approve their own comic', async () => {
    const contributor = await createUser('contributor');
    const comic = await createComic(contributor);

    const res = await api().patch(`/moderation/comics/${comic.id}`).set(auth(contributor)).send({ status: 'accept' });
    expect(res.status).toBe(403);
  });

  it('a moderator can approve a comic', async () => {
    const contributor = await createUser('contributor');
    const moderator = await createUser('moderator');
    const comic = await createComic(contributor);

    const res = await api().patch(`/moderation/comics/${comic.id}`).set(auth(moderator)).send({ status: 'accept' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: comic.id, status: 'accept' });
  });

  it('a contributor cannot edit a comic owned by another contributor', async () => {
    const owner = await createUser('contributor');
    const other = await createUser('contributor');
    const comic = await createComic(owner);

    const res = await api()
      .patch(`/comics/${comic.id}`)
      .set(auth(other))
      .send({ name: 'hijacked', types: 'manga', demographic: 'shounen', url: comic.url });
    expect(res.status).toBe(403);
  });

  it('the owner can edit their comic', async () => {
    const owner = await createUser('contributor');
    const comic = await createComic(owner);

    const res = await api()
      .patch(`/comics/${comic.id}`)
      .set(auth(owner))
      .send({ name: 'renamed', types: 'manga', demographic: 'shounen', url: comic.url, genres: ['Action', 'action'] });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('renamed');
  });

  it('a regular user cannot create comics', async () => {
    const user = await createUser();
    const res = await api().post('/comics').set(auth(user)).send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  it('changing the password requires the current password', async () => {
    const user = await createUser();
    const res = await api()
      .put('/me/password')
      .set(auth(user))
      .send({ currentPassword: 'not-it', newPassword: 'newsecret1', confirmPassword: 'newsecret1' });
    expect(res.status).toBe(401);

    const ok = await api()
      .put('/me/password')
      .set(auth(user))
      .send({ currentPassword: user.password, newPassword: 'newsecret1', confirmPassword: 'newsecret1' });
    expect(ok.status).toBe(204);
  });

  it('rejects SVG uploads (stored XSS) with 415', async () => {
    const user = await createUser();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await api()
      .put('/me/avatar')
      .set(auth(user))
      .attach('avatar', svg, { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(415);
  });

  it('an admin cannot change their own role', async () => {
    const admin = await createUser('admin');
    const res = await api().patch(`/admin/users/${admin.id}`).set(auth(admin)).send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  it('PATCH /admin/users validates the body before writing', async () => {
    const admin = await createUser('admin');
    const user = await createUser();
    expect((await api().patch(`/admin/users/${user.id}`).set(auth(admin)).send({})).status).toBe(400);
    expect((await api().patch(`/admin/users/${user.id}`).set(auth(admin)).send({ role: 'king' })).status).toBe(400);
    expect((await api().patch('/admin/users/missing').set(auth(admin)).send({ role: 'user' })).status).toBe(404);

    const res = await api().patch(`/admin/users/${user.id}`).set(auth(admin)).send({ role: 'contributor' });
    expect(res.body.data).toMatchObject({ id: user.id, role: 'contributor', isBanned: false });
  });
});
