// What readers may see and act on: content approved by staff, public and not deleted.
// Reader-facing pages (catalogue, reader, profile) only ever touch such rows, whatever the viewer's
// role; the studio and the moderation/admin console have their own routes that see everything.

// For Sequelize `where` objects on comics and chapters.
export const READABLE = { status: 'accept', visibility: 'public', deletedAt: null };

// For raw SQL: `alias` is the comics / chapters table alias used in the query.
export const readableSql = (alias) =>
  `${alias}.status = 'accept' AND ${alias}.visibility = 'public' AND ${alias}.deletedAt IS NULL`;
