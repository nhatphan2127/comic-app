import { describe, it, expect } from 'vitest';
import { api, models, createUser, auth, sessionCookie, ORIGIN, PREFIX } from './helpers.js';

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

  it('logout answers 204, clears the cookie and invalidates the session', async () => {
    const user = await createUser();
    const res = await api().post('/auth/logout').set(auth(user));
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(res.headers['set-cookie'][0]).toMatch(/^sid=;.*Expires=Thu, 01 Jan 1970/);
    expect((await api().get('/me').set(auth(user))).status).toBe(401);
  });

  it('login sets an HttpOnly session cookie and keeps the token out of the body', async () => {
    const user = await createUser();
    const res = await api().post('/auth/login').send({ userName: user.userName, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.user.userName).toBe(user.userName);

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sid='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api/);
    expect((await api().get('/me').set('Cookie', sessionCookie(res))).status).toBe(200);
  });

  it('no longer accepts the session token as a Bearer header', async () => {
    const user = await createUser();
    const token = user.cookie.slice('sid='.length);
    expect((await api().get('/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('blocks cookie-authenticated writes from an untrusted or missing origin (CSRF)', async () => {
    const user = await createUser();
    const patch = () => api().patch('/me').set('Cookie', user.cookie).send({ displayName: 'csrf' });

    expect((await patch().set('Origin', 'https://evil.example')).status).toBe(403);
    expect((await patch()).status).toBe(403);
    expect((await patch().set('Referer', 'https://evil.example/page')).status).toBe(403);
    expect((await patch().set('Origin', ORIGIN)).status).toBe(200);
    // Reads are not state-changing and stay allowed from anywhere (CORS still hides the response).
    expect((await api().get('/me').set('Cookie', user.cookie)).status).toBe(200);
  });
});
