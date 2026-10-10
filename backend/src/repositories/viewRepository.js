// View counting (comics.view, comic_daily_views, user_read_days) and the rankings built on it.
// Days are UTC 'YYYY-MM-DD' buckets taken from SQLite's clock, like every other timestamp.
import { literal } from 'sequelize';
import { select, sequelize } from '../config/database.js';
import { Comic } from '../models/index.js';
import { LIST_COLUMNS } from './comicRepository.js';
import { readableSql } from './visibility.js';

// Opening the same chapter again within this window is not a new view.
const REVIEW_WINDOW = '-30 minutes';

// The viewer's previous visit of a chapter, read before it is overwritten:
// { recent: 1 if within REVIEW_WINDOW, today: 1 if earlier today }, or undefined if never opened.
export const findPreviousVisit = async (userId, chapterId) =>
  (await select(
    `SELECT readAt > datetime('now', ?) AS recent,
            readAt >= date('now') || ' 00:00:00' AS today
     FROM read_history WHERE userId = ? AND chapterId = ?`,
    [REVIEW_WINDOW, userId, chapterId]
  ))[0];

export async function addComicView(comicId) {
  await Comic.update({ view: literal('view + 1') }, { where: { id: comicId } });
  await sequelize.query(
    `INSERT INTO comic_daily_views (comicId, day, views) VALUES (?, date('now'), 1)
     ON CONFLICT(comicId, day) DO UPDATE SET views = views + 1`,
    { replacements: [comicId] }
  );
}

export const addUserReadChapter = (userId) =>
  sequelize.query(
    `INSERT INTO user_read_days (userId, day, chapters) VALUES (?, date('now'), 1)
     ON CONFLICT(userId, day) DO UPDATE SET chapters = chapters + 1`,
    { replacements: [userId] }
  );

// ---------- Rankings ----------

export const RANKING_PERIODS = ['day', 'week', 'month', 'all'];

// First day of each period, as a date() modifier: today, the last 7 days, the last 30 days.
const PERIOD_START = { day: '-0 days', week: '-6 days', month: '-29 days' };

// score = views + 5 × new follows + 3 × new ratings within the period; `all` uses the running totals.
function rankedSql(period, contentRatings) {
  const since = "date('now', :start)";
  const sinceTime = `${since} || ' 00:00:00'`;
  const joins = period === 'all'
    ? `LEFT JOIN (SELECT comicId, COUNT(*) AS n FROM rating_history GROUP BY comicId) r ON r.comicId = c.id`
    : `LEFT JOIN (SELECT comicId, SUM(views) AS n FROM comic_daily_views WHERE day >= ${since} GROUP BY comicId) v ON v.comicId = c.id
       LEFT JOIN (SELECT comicId, COUNT(*) AS n FROM following WHERE createdAt >= ${sinceTime} GROUP BY comicId) f ON f.comicId = c.id
       LEFT JOIN (SELECT comicId, COUNT(*) AS n FROM rating_history WHERE createdAt >= ${sinceTime} GROUP BY comicId) r ON r.comicId = c.id`;
  const score = period === 'all'
    ? 'c.view + 5 * c.follow + 3 * COALESCE(r.n, 0)'
    : 'COALESCE(v.n, 0) + 5 * COALESCE(f.n, 0) + 3 * COALESCE(r.n, 0)';
  const ratingFilter = contentRatings.length ? 'AND lower(c.contentRating) IN (:contentRatings)' : '';
  // Comics nobody touched during the period are not ranked.
  return `SELECT ${LIST_COLUMNS.map((column) => `c.${column}`).join(', ')}, ${score} AS score
          FROM comics c ${joins}
          WHERE ${readableSql('c')} ${ratingFilter} AND ${score} > 0`;
}

const rankedReplacements = (period, contentRatings) => ({ start: PERIOD_START[period] ?? '-0 days', contentRatings });

// Best first; ties go to the most followed comic, then to the id so pages stay stable.
export const listRanked = ({ period, contentRatings = [], limit, offset }) =>
  select(
    `${rankedSql(period, contentRatings)} ORDER BY score DESC, c.follow DESC, c.id LIMIT :limit OFFSET :offset`,
    { ...rankedReplacements(period, contentRatings), limit, offset }
  );

export const countRanked = async ({ period, contentRatings = [] }) =>
  (await select(`SELECT COUNT(*) AS total FROM (${rankedSql(period, contentRatings)})`, rankedReplacements(period, contentRatings)))[0].total;
