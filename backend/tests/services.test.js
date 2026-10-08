// Service-level tests: call the business functions directly, no HTTP server, no req/res.
// This is only possible because services don't depend on Express.
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../src/config/database.js';
import { Comic, User } from '../src/models/index.js';
import * as interactionService from '../src/services/interactionService.js';
import * as followRepo from '../src/repositories/followRepository.js';
import { NotFoundError, BadRequestError } from '../src/errors.js';

async function seedUserAndComic() {
  const userId = randomUUID();
  const comicId = randomUUID();
  await User.create({ id: userId, username: `u-${userId}`, password: 'x' });
  await Comic.create({
    id: comicId, name: 'c', types: 'manga', contentRating: 'safe', demographic: 'shounen', releaseStatus: 'releasing', url: `c-${comicId}`,
  });
  return { userId, comicId };
}

describe('interactionService (no HTTP)', () => {
  it('followComic throws NotFoundError for an unknown comic', async () => {
    const { userId } = await seedUserAndComic();
    await expect(interactionService.followComic(userId, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rateComic validates the range before touching the database', async () => {
    const { userId, comicId } = await seedUserAndComic();
    await expect(interactionService.rateComic(userId, comicId, 0)).rejects.toBeInstanceOf(BadRequestError);
  });

  it('followComic is idempotent for the counter', async () => {
    const { userId, comicId } = await seedUserAndComic();
    await interactionService.followComic(userId, comicId);
    await interactionService.followComic(userId, comicId);
    expect((await Comic.findByPk(comicId)).follow).toBe(1);
  });
});

describe('withTransaction', () => {
  it('rolls back every write when a later step fails', async () => {
    const { userId, comicId } = await seedUserAndComic();

    await expect(
      withTransaction(async () => {
        await followRepo.insert({ userId, comicId, categoryId: null });
        throw new Error('step 2 failed'); // e.g. the counter UPDATE crashed
      })
    ).rejects.toThrow('step 2 failed');

    // The follow row from step 1 must not survive.
    expect(await followRepo.find(userId, comicId)).toBeNull();
  });
});
