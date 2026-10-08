import { describe, it, expect } from 'vitest';
import { api, models, createUser, auth, PREFIX } from './helpers.js';

describe('auth', () => {
  it('rejects invalid register input with 400', async () => {
    const res = await api().post('/auth/register').send({ userName: 'x', password: '1', email: 'bad', displayName: '' });
    expect(res.status).toBe(400);
  });

  it('register answers 201 with a Location header', async () => {
    const res = await api().post('/auth/register').send({ userName: 'newbie1', password: 'secret123', email: 'n@test.dev', displayName: 'N' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`${PREFIX}/me`);
    expect(res.body.data.userName).toBe('newbie1');
  });

  it('stores passwords as bcrypt hashes, never plain text', async () => {
    const user = await createUser();
    const row = await models.User.findByPk(user.id, { raw: true });
    expect(row.password).not.toBe(user.password);
    expect(row.password).toMatch(/^\$2[aby]\$/);
  });

  it('returns 409 for a duplicate username', async () => {
    const user = await createUser();
    const res = await api()
      .post('/auth/register')
      .send({ userName: user.userName, password: 'secret123', email: 'dup@test.dev', displayName: 'dup' });
    expect(res.status).toBe(409);
  });

  it('returns 401 with WWW-Authenticate for a wrong password', async () => {
    const user = await createUser();
    const res = await api().post('/auth/login').send({ userName: user.userName, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('blocks banned users from logging in and from using old tokens', async () => {
    const admin = await createUser('admin');
    const user = await createUser();

    const ban = await api().patch(`/admin/users/${user.id}`).set(auth(admin)).send({ isBanned: true });
    expect(ban.status).toBe(200);
    expect(ban.body.data.isBanned).toBe(true);

    const login = await api().post('/auth/login').send({ userName: user.userName, password: user.password });
    expect(login.status).toBe(403);

    expect((await api().get('/me').set(auth(user))).status).toBe(401);
  });

  it('logout answers 204 and invalidates the token', async () => {
    const user = await createUser();
    const res = await api().post('/auth/logout').set(auth(user));
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await api().get('/me').set(auth(user))).status).toBe(401);
  });
});
