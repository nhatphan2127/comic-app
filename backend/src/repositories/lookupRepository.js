// Name-only lookup tables (author, artist, genres, formats).
import { v4 as uuidv4 } from 'uuid';
import { col, fn, where } from 'sequelize';
import { Artist, Author, Format, Genre } from '../models/index.js';

const LOOKUP_MODELS = { author: Author, artist: Artist, genres: Genre, formats: Format };

function modelFor(table) {
  const model = LOOKUP_MODELS[table];
  if (!model) throw new Error(`Unknown lookup table: ${table}`);
  return model;
}

// Case-insensitive match on name; inserts a new row when none exists. Returns the id (or null for a blank name).
export async function findOrCreateByName(table, name) {
  const Model = modelFor(table);
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;

  const existing = await Model.findOne({ attributes: ['id'], where: where(fn('lower', col('name')), fn('lower', trimmed)), raw: true });
  if (existing) return existing.id;

  const id = uuidv4();
  await Model.create({ id, name: trimmed });
  return id;
}

// Accepts a single value or an array; returns the distinct ids.
export async function findOrCreateMany(table, values) {
  const items = Array.isArray(values) ? values : values ? [values] : [];
  const ids = [];
  for (const value of items) {
    const id = await findOrCreateByName(table, value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
