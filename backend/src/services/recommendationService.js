// Comic recommendations: a hybrid of content-based filtering (CBF) and user-based collaborative
// filtering (CF), see FEATURES-PLAN.md, phase 3.
//
// The algorithm is a set of pure functions over Maps (exported: the tests and
// scripts/evalRecommendations.js call them directly). The rest of the file loads their inputs and caches:
// - the comic vectors, for everyone, 15 minutes;
// - each user's ranked list, 15 minutes, dropped as soon as they follow, rate, read or change their
//   content filter (see forgetUser).
// Everything is computed on request, which is enough at this scale. With many more users, the item
// vectors and the neighbour lists would move to tables refreshed by a background job.
import * as recommendationRepo from '../repositories/recommendationRepository.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as viewRepo from '../repositories/viewRepository.js';
import * as preferenceRepo from '../repositories/preferenceRepository.js';
import { withGenresAndLatestChapters } from './comicService.js';
import { NotFoundError } from '../errors.js';

// ---------- Pure algorithm ----------

const MAX_CHAPTERS_COUNTED = 10;
const DISLIKE_RATING = 2; // a rating at or below this means "not for me"
const DISLIKE_PENALTY = 0.5; // how much of a disliked comic's features is taken off the user's profile
// Below this cosine a comic barely resembles what the user likes: better a short list than the whole catalogue.
export const MIN_CONTENT_SCORE = 0.2;

// How much user u likes comic i, from implicit signals (there are too few ratings to rely on them alone):
// w = 3 × followed + 2 × min(distinct chapters read, 10) / 10 + (rating − 3 if rated), never below 0.
export function interactionWeight({ followed, chaptersRead, rating }) {
  const w = 3 * (followed ? 1 : 0)
    + (2 * Math.min(Number(chaptersRead) || 0, MAX_CHAPTERS_COUNTED)) / MAX_CHAPTERS_COUNTED
    + (rating ? rating - 3 : 0);
  return Math.max(w, 0);
}

export const isDisliked = ({ rating }) => rating != null && rating <= DISLIKE_RATING;

// Sparse vectors are Maps key → number.
const norm = (v) => Math.sqrt([...v.values()].reduce((sum, x) => sum + x * x, 0));

export function cosine(a, b) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  small.forEach((x, key) => {
    const y = large.get(key);
    if (y) dot += x * y;
  });
  const n = norm(a) * norm(b);
  return n ? dot / n : 0;
}

// Cosines that only differ by rounding errors are ties.
const round = (x) => Math.round(x * 1e6) / 1e6;

// comics: [{ id, features: ['genre:wuxia', 'type:manhua', …] }] →
// { vectors: id → (feature → weight, L2-normalised), idf: feature → weight, mainGenre: id → genre | null }.
// A feature weighs idf(f) = ln(N / n_f) (N comics, n_f of them have f): rare features ("Wuxia") count more
// than common ones ("Action"), and a feature every comic has says nothing (0).
export function buildItemVectors(comics) {
  const counts = new Map();
  comics.forEach((comic) => new Set(comic.features).forEach((f) => counts.set(f, (counts.get(f) || 0) + 1)));
  const idf = new Map([...counts].map(([f, n]) => [f, Math.log(comics.length / n)]));

  const vectors = new Map();
  const mainGenre = new Map();
  comics.forEach(({ id, features }) => {
    const own = [...new Set(features)];
    const vector = new Map(own.filter((f) => idf.get(f) > 0).map((f) => [f, idf.get(f)]));
    const n = norm(vector);
    vector.forEach((x, f) => vector.set(f, x / n));
    vectors.set(id, vector);
    // The comic's broadest genre (the most common one) is what diversify() keeps from repeating.
    const genres = own.filter((f) => f.startsWith('genre:')).sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
    mainGenre.set(id, genres[0] ?? null);
  });
  return { vectors, idf, mainGenre };
}

// p_u = Σ w(u,i)·x_i − 0.5·Σ x_j over disliked j; score_cb(u,i) = cos(p_u, x_i), kept when ≥ MIN_CONTENT_SCORE.
export function contentScores(likes, disliked, vectors) {
  const profile = new Map();
  const add = (comicId, k) => vectors.get(comicId)?.forEach((x, f) => profile.set(f, (profile.get(f) || 0) + k * x));
  likes.forEach((w, comicId) => add(comicId, w));
  disliked.forEach((comicId) => add(comicId, -DISLIKE_PENALTY));

  const scores = new Map();
  vectors.forEach((x, comicId) => {
    const score = cosine(profile, x);
    if (score >= MIN_CONTENT_SCORE) scores.set(comicId, score);
  });
  return scores;
}

const NEIGHBOURS = 30; // K
const MIN_SIMILARITY = 0.1;
const MIN_COMMON = 2; // fewer comics in common is noise
const FULL_SIGNIFICANCE = 5; // similarities resting on fewer common comics are shrunk (significance weighting)
const MIN_SUPPORTERS = 2;

// likes: comic → w(u, ·) > 0; others: user → (comic → w > 0).
// sim(u,v) = cos(w_u, w_v) × min(common, 5) / 5, keeping the K most similar v with sim ≥ 0.1 and ≥ 2 comics
// in common. score_cf(u,i) = Σ sim(u,v)·w(v,i) over the neighbours v who like i, kept when at least 2 of them
// do. → { scores: comic → { score, supporters }, neighbourCount }.
// A sum, not the weighted average Σ sim·w / Σ sim used to predict ratings: for picking the top N, a comic
// many neighbours like must beat one that two of them like a lot. The average ignores that, and the offline
// evaluation (scripts/evalRecommendations.js) shows it: Precision@10 0.03 with the average, 0.16 with the sum.
export function userBasedScores(likes, others) {
  const neighbours = [];
  others.forEach((theirs, userId) => {
    let common = 0;
    likes.forEach((_, comicId) => {
      if (theirs.get(comicId) > 0) common += 1;
    });
    if (common < MIN_COMMON) return;
    const sim = cosine(likes, theirs) * (Math.min(common, FULL_SIGNIFICANCE) / FULL_SIGNIFICANCE);
    if (sim >= MIN_SIMILARITY) neighbours.push({ userId, sim, theirs });
  });
  neighbours.sort((a, b) => b.sim - a.sim || (a.userId < b.userId ? -1 : 1));
  const top = neighbours.slice(0, NEIGHBOURS);

  const sums = new Map();
  top.forEach(({ sim, theirs }) =>
    theirs.forEach((w, comicId) => {
      if (w <= 0) return;
      const sum = sums.get(comicId) ?? { score: 0, supporters: 0 };
      sum.score += sim * w;
      sum.supporters += 1;
      sums.set(comicId, sum);
    }));

  const scores = new Map();
  sums.forEach((sum, comicId) => {
    if (sum.supporters >= MIN_SUPPORTERS) scores.set(comicId, sum);
  });
  return { scores, neighbourCount: top.length };
}

const MAX_ALPHA = 0.7;
const NEIGHBOURS_FOR_MAX_ALPHA = 20;

// α = min(0.7, |N(u)| / 20): with few neighbours, content counts more.
export const cfShare = (neighbourCount) => Math.min(MAX_ALPHA, neighbourCount / NEIGHBOURS_FOR_MAX_ALPHA);

// Each score is scaled to [0, 1] by the best candidate's, then score = α·cf + (1 − α)·cb.
// → [{ comicId, score, cf, cb, supporters }] best first, where cf / cb are the two weighted parts.
export function blend({ cf, cb, neighbourCount, isCandidate = () => true }) {
  const alpha = cfShare(neighbourCount);
  const ids = [...new Set([...cf.keys(), ...cb.keys()])].filter(isCandidate);
  const maxCf = ids.reduce((max, id) => Math.max(max, cf.get(id)?.score ?? 0), 0);
  const maxCb = ids.reduce((max, id) => Math.max(max, cb.get(id) ?? 0), 0);

  return ids
    .map((comicId) => {
      const cfPart = maxCf ? (alpha * (cf.get(comicId)?.score ?? 0)) / maxCf : 0;
      const cbPart = maxCb ? ((1 - alpha) * (cb.get(comicId) ?? 0)) / maxCb : 0;
      return { comicId, score: cfPart + cbPart, cf: cfPart, cb: cbPart, supporters: cf.get(comicId)?.supporters ?? 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => round(b.score) - round(a.score) || (a.comicId < b.comicId ? -1 : 1));
}

const MAX_RUN = 3;

// Greedy re-rank: no more than 3 comics in a row share their main genre, unless nothing else is left.
export function diversify(ranked, groupOf) {
  const pool = [...ranked];
  const out = [];
  while (pool.length) {
    const recent = out.slice(-MAX_RUN).map((item) => groupOf(item.comicId));
    const blocked = recent.length === MAX_RUN && recent[0] && recent.every((group) => group === recent[0]) ? recent[0] : null;
    const next = blocked ? pool.findIndex((item) => groupOf(item.comicId) !== blocked) : 0;
    out.push(pool.splice(Math.max(next, 0), 1)[0]);
  }
  return out;
}

// ---------- Loading and caching ----------

const CACHE_TTL_MS = 15 * 60 * 1000;
export const MAX_RECOMMENDATIONS = 50;
export const MAX_SIMILAR = 30;
const NEIGHBOUR_CANDIDATES = 500;
// user_preferences.filter is the index of the highest rating shown.
const CONTENT_LEVELS = ['safe', 'suggestive', 'erotica', 'pornographic'];
const DEFAULT_FILTER = 1;

let itemModel = null; // buildItemVectors() + comics: id → { contentRating, view }, expiresAt
const userLists = new Map(); // userId → { items: [{ comicId, score, reason }], expiresAt }

// `requiredId`: rebuild early when that comic is missing (approved after the model was built).
async function loadItemModel(requiredId = null) {
  if (itemModel && itemModel.expiresAt > Date.now() && (!requiredId || itemModel.vectors.has(requiredId))) return itemModel;
  const comics = await recommendationRepo.comicFeatures();
  itemModel = {
    ...buildItemVectors(comics),
    comics: new Map(comics.map(({ id, contentRating, view }) => [id, { contentRating, view }])),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return itemModel;
}

// The user's likes changed (follow, rating, a new chapter read, content filter): recompute next time.
export const forgetUser = (userId) => userLists.delete(userId);

// Tests start from an empty cache.
export function clearCache() {
  itemModel = null;
  userLists.clear();
}

// GET /me/recommendations: up to `limit` catalogue items, each with `score` (0..1) and `reason`.
export async function recommendFor(userId, limit) {
  let cached = userLists.get(userId);
  if (!cached || cached.expiresAt <= Date.now()) {
    cached = { items: await rank(userId), expiresAt: Date.now() + CACHE_TTL_MS };
    userLists.set(userId, cached);
  }
  return toCatalogueItems(cached.items, limit);
}

async function rank(userId) {
  const [model, mine, preference] = await Promise.all([
    loadItemModel(),
    recommendationRepo.interactionsOfUser(userId),
    preferenceRepo.find(userId),
  ]);
  const allowed = CONTENT_LEVELS.slice(0, (preference?.filter ?? DEFAULT_FILTER) + 1);

  const likes = new Map();
  const disliked = [];
  mine.forEach((row) => {
    const w = interactionWeight(row);
    if (w > 0) likes.set(row.comicId, w);
    if (isDisliked(row)) disliked.push(row.comicId);
  });
  // Anything the user already followed, read or rated is known to them.
  const known = new Set(mine.map((row) => row.comicId));
  const isCandidate = (comicId) => !known.has(comicId) && allowed.includes(model.comics.get(comicId)?.contentRating);

  // Cold start: nothing liked yet, so nothing to go on but what is popular.
  if (!likes.size) return trending(allowed, known, MAX_RECOMMENDATIONS);

  const neighbourIds = await recommendationRepo.usersWhoInteractedWith([...likes.keys()], userId, NEIGHBOUR_CANDIDATES);
  const others = new Map();
  (await recommendationRepo.interactionsOfUsers(neighbourIds)).forEach((row) => {
    const w = interactionWeight(row);
    if (w <= 0) return;
    if (!others.has(row.userId)) others.set(row.userId, new Map());
    others.get(row.userId).set(row.comicId, w);
  });

  const { scores: cf, neighbourCount } = userBasedScores(likes, others);
  const cb = contentScores(likes, disliked, model.vectors);
  const ranked = diversify(
    blend({ cf, cb, neighbourCount, isCandidate }).slice(0, MAX_RECOMMENDATIONS * 3),
    (comicId) => model.mainGenre.get(comicId)
  ).slice(0, MAX_RECOMMENDATIONS);

  const items = ranked.map((item) => ({
    comicId: item.comicId,
    score: round(item.score),
    reason: item.cf >= item.cb
      ? { type: 'similar_readers', count: item.supporters }
      : { type: 'because_you_liked', comicId: closestLiked(item.comicId, likes, model.vectors) },
  }));

  // Only what the algorithm thinks fits, even if that is a short list (no filling up with trending comics).
  return items;
}

// The liked comic most similar to `comicId`: "because you liked X".
function closestLiked(comicId, likes, vectors) {
  const x = vectors.get(comicId);
  let best = null;
  let bestScore = -1;
  likes.forEach((_, likedId) => {
    const score = round(cosine(x, vectors.get(likedId) ?? new Map()));
    if (score > bestScore || (score === bestScore && likedId < best)) [best, bestScore] = [likedId, score];
  });
  return best;
}

// This week's rankings, then all-time ones, without the `excluded` comics.
async function trending(contentRatings, excluded, count) {
  const items = [];
  const seen = new Set(excluded);
  for (const period of ['week', 'all']) {
    const rows = await viewRepo.listRanked({ period, contentRatings, limit: count + excluded.size, offset: 0 });
    for (const { id } of rows) {
      if (items.length >= count) return items;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({ comicId: id, score: 0, reason: { type: 'trending' } });
    }
  }
  return items;
}

// Ranked ids → catalogue items, in order. Comics hidden since the list was cached are skipped.
async function toCatalogueItems(ranked, limit) {
  const likedIds = ranked.map((item) => item.reason.comicId).filter(Boolean);
  const rows = await comicRepo.listPublicByIds([...new Set([...ranked.map((item) => item.comicId), ...likedIds])]);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const picked = ranked
    .filter((item) => byId.has(item.comicId) && (!item.reason.comicId || byId.has(item.reason.comicId)))
    .slice(0, limit);
  const comics = await withGenresAndLatestChapters(picked.map((item) => byId.get(item.comicId)));
  return comics.map((comic, index) => {
    const { score, reason } = picked[index];
    if (!reason.comicId) return { ...comic, score, reason };
    const { id, url, name } = byId.get(reason.comicId);
    return { ...comic, score, reason: { type: reason.type, comic: { id, url, name } } };
  });
}

// GET /comics/:comicId/similar: the comics closest in content, cos(x_i, x_j), ties to the most viewed.
// Not personalised, so guests get it too. `contentRatings` ([] = all) is the viewer's content filter.
export async function similarTo(key, { limit, contentRatings = [] }) {
  const comic = await comicRepo.findPublicIdByKey(key);
  if (!comic) throw new NotFoundError('Comic not found');
  const model = await loadItemModel(comic.id);
  const x = model.vectors.get(comic.id) ?? new Map();

  const scored = [];
  model.vectors.forEach((y, id) => {
    const { contentRating, view } = model.comics.get(id);
    if (id === comic.id || (contentRatings.length && !contentRatings.includes(contentRating))) return;
    const similarity = round(cosine(x, y));
    if (similarity > 0) scored.push({ id, similarity, view });
  });
  scored.sort((a, b) => b.similarity - a.similarity || b.view - a.view || (a.id < b.id ? -1 : 1));

  const top = scored.slice(0, limit);
  const rows = new Map((await comicRepo.listPublicByIds(top.map((item) => item.id))).map((row) => [row.id, row]));
  const kept = top.filter((item) => rows.has(item.id));
  const comics = await withGenresAndLatestChapters(kept.map((item) => rows.get(item.id)));
  return comics.map((item, index) => ({ ...item, similarity: kept[index].similarity }));
}
