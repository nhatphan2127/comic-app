import { col, fn } from 'sequelize';
import { now } from '../config/database.js';
import { RatingHistory } from '../models/index.js';

export const findUserRating = async (userId, comicId) =>
  (await RatingHistory.findOne({ attributes: ['rating'], where: { userId, comicId }, raw: true }))?.rating ?? null;

// One statement instead of "SELECT then INSERT or UPDATE": the primary key (userId, comicId) decides.
export const upsert = (userId, comicId, rating) => RatingHistory.upsert({ userId, comicId, rating, updatedAt: now() });

export const remove = (userId, comicId) => RatingHistory.destroy({ where: { userId, comicId } });

// The database computes the average; no need to load every rating into JS.
export const averageForComic = async (comicId) =>
  (await RatingHistory.findOne({ attributes: [[fn('AVG', col('rating')), 'average']], where: { comicId }, raw: true }))?.average || 0;
