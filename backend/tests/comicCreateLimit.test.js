import { describe, it, expect } from 'vitest';

// The limit is read when the app is imported, so lower it before loading the helpers.
process.env.COMIC_CREATE_RATE_LIMIT = '3';
const { api, auth, createUser, createComic, models, unique, PNG } = await import('./helpers.js');

function comicRequest(user, fields = {}) {
  const url = fields.url || unique('comic-');
  const req = api()
    .post('/comics')
    .set(auth(user))
    .field('name', fields.name ?? url)
    .field('types', fields.types || 'manga')
    .field('contentRating', fields.contentRating || 'safe')
    .field('url', url);
  return req.attach('coverImage', PNG, { filename: 'cover.png', contentType: 'image/png' });
}

describe('new comics per account', () => {
  it('limits successful Studio creations per account; failed attempts are free', async () => {
    const contributor = await createUser('contributor');
    await createComic(contributor);
    expect((await comicRequest(contributor, { name: '' })).status).toBe(400);
    await createComic(contributor);

    await createComic(contributor);
    const limited = await comicRequest(contributor);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    await createComic(await createUser('contributor'));
  });

  it('retires the API-key and publishing endpoints', async () => {
    const contributor = await createUser('contributor');
    expect((await api().get('/me/api-keys').set(auth(contributor))).status).toBe(404);
    expect((await api().post('/publish/comics')).status).toBe(404);
    const [apiKeyTables] = await models.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_keys'",
    );
    expect(apiKeyTables).toEqual([]);
  });
});
