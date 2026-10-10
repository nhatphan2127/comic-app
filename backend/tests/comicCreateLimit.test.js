import { describe, it, expect } from 'vitest';

// The limit is read when the app is imported, so lower it before loading the helpers (which import the app).
process.env.COMIC_CREATE_RATE_LIMIT = '3';
const { api, auth, createUser, createComic, unique, PNG } = await import('./helpers.js');

const PASSWORD = 'secret123';

async function createKey(user) {
  const res = await api().post('/me/api-keys').set(auth(user)).send({ name: unique('script '), password: PASSWORD });
  if (res.status !== 201) throw new Error(`createKey failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

function publishComic(token, fields = {}) {
  const req = api().post('/publish/comics').set({ Authorization: `Bearer ${token}` });
  const all = { name: unique('Comic '), type: 'manhwa', demographic: 'seinen', contentRating: 'safe', ...fields };
  Object.entries(all).forEach(([k, v]) => req.field(k, v));
  return req.attach('cover', PNG, { filename: 'cover.png', contentType: 'image/png' });
}

describe('new comics per account', () => {
  it('one budget for the Studio and every API key of the account; failed attempts are free', async () => {
    const contributor = await createUser('contributor');
    const [first, second] = [await createKey(contributor), await createKey(contributor)];

    await createComic(contributor);
    expect((await publishComic(first)).status).toBe(201);
    // Rejected uploads don't use up the budget.
    expect((await publishComic(first, { type: 'novel' })).status).toBe(400);
    expect((await publishComic(second)).status).toBe(201);

    // 3 created: a new key or the website doesn't help.
    const limited = await publishComic(second);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    await expect(createComic(contributor)).rejects.toThrow(/429/);

    // Other accounts have their own budget.
    await createComic(await createUser('contributor'));
  });
});
