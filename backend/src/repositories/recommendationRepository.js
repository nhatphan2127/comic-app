// Inputs of the recommender (services/recommendationService.js): who did what with which comic, and
// what each comic is made of. Only readable comics (and readable chapters for reading counts).
import { select } from '../config/database.js';
import { readableSql } from './visibility.js';

// One row per (user, comic) the users touched: { userId, comicId, followed 0|1, chaptersRead, rating|null }.
// `userIds` must not be empty.
const interactionsSql = `
  SELECT x.userId, x.comicId, MAX(x.followed) AS followed, MAX(x.chaptersRead) AS chaptersRead, MAX(x.rating) AS rating
  FROM (
    SELECT userId, comicId, 1 AS followed, 0 AS chaptersRead, NULL AS rating
    FROM following WHERE userId IN (:userIds)
    UNION ALL
    SELECT rh.userId, ch.comicId, 0, COUNT(DISTINCT rh.chapterId), NULL
    FROM read_history rh JOIN chapters ch ON ch.id = rh.chapterId
    WHERE rh.userId IN (:userIds) AND ${readableSql('ch')}
    GROUP BY rh.userId, ch.comicId
    UNION ALL
    SELECT userId, comicId, 0, 0, rating
    FROM rating_history WHERE userId IN (:userIds)
  ) x
  JOIN comics c ON c.id = x.comicId
  WHERE ${readableSql('c')}
  GROUP BY x.userId, x.comicId`;

export const interactionsOfUsers = (userIds) => (userIds.length ? select(interactionsSql, { userIds }) : []);

export const interactionsOfUser = (userId) => interactionsOfUsers([userId]);

// Other users who liked at least one of `comicIds` (followed, read or rated it 4+), those sharing the
// most of them first. These are the candidate neighbours of user-based collaborative filtering.
export const usersWhoInteractedWith = async (comicIds, excludeUserId, limit) =>
  comicIds.length
    ? (await select(
        `SELECT userId, COUNT(*) AS shared FROM (
           SELECT userId, comicId FROM following WHERE comicId IN (:comicIds)
           UNION
           SELECT rh.userId, ch.comicId FROM read_history rh JOIN chapters ch ON ch.id = rh.chapterId
           WHERE ch.comicId IN (:comicIds) AND ${readableSql('ch')}
           UNION
           SELECT userId, comicId FROM rating_history WHERE comicId IN (:comicIds) AND rating >= 4
         )
         WHERE userId <> :excludeUserId
         GROUP BY userId
         ORDER BY shared DESC, userId
         LIMIT :limit`,
        { comicIds, excludeUserId, limit }
      )).map((row) => row.userId)
    : [];

// Every readable comic with what the content model looks at: [{ id, contentRating, view, features }],
// features = 'genre:…', 'format:…', 'demographic:…', 'type:…' (lower case).
export async function comicFeatures() {
  const [comics, genres, formats] = await Promise.all([
    select(`SELECT c.id, lower(c.contentRating) AS contentRating, c.view, lower(c.types) AS types, lower(c.demographic) AS demographic
            FROM comics c WHERE ${readableSql('c')}`),
    select(`SELECT cg.comicId, lower(g.name) AS name FROM comic_genres cg
            JOIN genres g ON g.id = cg.genreId JOIN comics c ON c.id = cg.comicId WHERE ${readableSql('c')}`),
    select(`SELECT cf.comicId, lower(f.name) AS name FROM comic_formats cf
            JOIN formats f ON f.id = cf.formatId JOIN comics c ON c.id = cf.comicId WHERE ${readableSql('c')}`),
  ]);
  const features = new Map(comics.map((c) => [c.id, [`type:${c.types}`, `demographic:${c.demographic}`]]));
  genres.forEach((row) => features.get(row.comicId)?.push(`genre:${row.name}`));
  formats.forEach((row) => features.get(row.comicId)?.push(`format:${row.name}`));
  return comics.map(({ id, contentRating, view }) => ({ id, contentRating, view, features: features.get(id) }));
}
