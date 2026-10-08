import { UserPreference } from '../models/index.js';

export async function find(userId) {
  const row = await UserPreference.findByPk(userId, { attributes: ['theme', 'filter', 'reader'], raw: true });
  if (!row) return null;
  let reader = null;
  try {
    reader = row.reader ? JSON.parse(row.reader) : null;
  } catch {
    /* a broken value counts as "never saved" */
  }
  return { ...row, reader };
}

export const insertDefault = (userId) => UserPreference.create({ userId, theme: 'main', filter: 1 });

// Missing values keep the stored value (or the model default for a new row).
export const upsert = (userId, { theme, filter, reader }) =>
  UserPreference.upsert({
    userId,
    ...(theme != null && { theme }),
    ...(filter != null && { filter }),
    ...(reader != null && { reader: JSON.stringify(reader) }),
  });
