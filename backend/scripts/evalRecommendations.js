// Offline evaluation of the recommender (FEATURES-PLAN.md, 3.8).
//
//   node scripts/evalRecommendations.js [--users 600] [--comics 400] [--seed 42]
//
// Builds a synthetic catalogue and synthetic readers, hides 20% of each reader's liked comics, asks each
// method for 10 comics among those the reader has not touched, and prints Precision@10 / Recall@10 for
// Popularity, CBF, CF and the Hybrid. It calls the same pure functions as GET /me/recommendations
// (src/services/recommendationService.js) and never touches the database.
//
// How the readers are made: each belongs to one of a few taste groups. A group has favourite genres
// (what content-based filtering can see) and a few "cult" comics its members like whatever their genres
// (what only collaborative filtering can see). Readers pick comics from their group's genres, from its
// cult list and from what is popular overall, and like them more or less (follow, chapters read, rating).
process.env.DB_PATH ??= ':memory:'; // the service module loads the models; keep the real database out of it

const {
  interactionWeight, isDisliked, buildItemVectors, contentScores, userBasedScores, blend, diversify,
} = await import('../src/services/recommendationService.js');

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? Number(process.argv[index + 1]) : fallback;
};
const USERS = arg('users', 600);
const COMICS = arg('comics', 400);
const SEED = arg('seed', 42);
const GROUPS = 8;
const TOP_N = 10;
const HIDDEN_SHARE = 0.2;
const MIN_LIKES = 5;

// Small seeded PRNG (mulberry32), so every run with the same --seed gives the same numbers.
let state = SEED >>> 0;
function random() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (items) => items[Math.floor(random() * items.length)];
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
// Index drawn with probability ∝ weights[i].
function weighted(weights) {
  let r = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ---------- Synthetic data ----------

const GENRES = Array.from({ length: 24 }, (_, i) => `genre:g${i}`);
const genrePopularity = GENRES.map((_, i) => 1 / (i + 1)); // a few broad genres, many niche ones
const TYPES = ['manga', 'manhwa', 'manhua', 'other'];
const DEMOGRAPHICS = ['josei', 'seinen', 'shoujo', 'shounen'];
const FORMATS = ['full color', 'long strip', 'web comic', 'adaptation'];

const comics = Array.from({ length: COMICS }, (_, i) => {
  const genres = new Set();
  const count = int(1, 4);
  while (genres.size < count) genres.add(GENRES[weighted(genrePopularity)]);
  const features = [...genres, `type:${pick(TYPES)}`, `demographic:${pick(DEMOGRAPHICS)}`];
  if (random() < 0.4) features.push(`format:${pick(FORMATS)}`);
  return { id: `c${i}`, features, popularity: 1 / (1 + i) ** 0.8 }; // a long tail
});

const comicsById = new Map(comics.map((comic) => [comic.id, comic]));

const groups = Array.from({ length: GROUPS }, () => {
  const favourites = new Set();
  while (favourites.size < 3) favourites.add(pick(GENRES));
  const cult = new Set();
  while (cult.size < 12) cult.add(pick(comics).id);
  return { favourites, cult: [...cult] };
});

const genreMatch = (comic, favourites) => comic.features.filter((f) => favourites.has(f)).length;

// user → comic → { followed, chaptersRead, rating }
const interactions = new Map();
for (let u = 0; u < USERS; u += 1) {
  const group = groups[u % GROUPS];
  const mine = new Map();
  const target = int(8, 35);
  const byTaste = comics.map((comic) => comic.popularity * (0.05 + genreMatch(comic, group.favourites)));
  const byPopularity = comics.map((comic) => comic.popularity);
  while (mine.size < target) {
    const source = random();
    const comic = source < 0.45 ? comics[weighted(byTaste)]
      : source < 0.75 ? comicsById.get(pick(group.cult))
        : comics[weighted(byPopularity)];
    const fits = genreMatch(comic, group.favourites) > 0 || group.cult.includes(comic.id);
    const followed = random() < (fits ? 0.6 : 0.15) ? 1 : 0;
    const chaptersRead = fits ? int(2, 30) : int(1, 4);
    const rating = random() < 0.3 ? (fits ? int(3, 5) : int(1, 3)) : null;
    mine.set(comic.id, { followed, chaptersRead, rating });
  }
  interactions.set(`u${u}`, mine);
}

// ---------- Evaluation ----------

const { vectors, mainGenre } = buildItemVectors(comics);

const likesOf = (rows) => {
  const likes = new Map();
  rows.forEach((row, comicId) => {
    const w = interactionWeight(row);
    if (w > 0) likes.set(comicId, w);
  });
  return likes;
};

// Split each reader's liked comics: 80% stay known (training), 20% are hidden (what we hope to find).
const splits = new Map();
interactions.forEach((rows, userId) => {
  const liked = [...rows].filter(([, row]) => interactionWeight(row) > 0 && !isDisliked(row)).map(([id]) => id);
  if (liked.length < MIN_LIKES) return;
  const shuffled = liked.sort(() => random() - 0.5);
  const hidden = new Set(shuffled.slice(0, Math.max(1, Math.round(liked.length * HIDDEN_SHARE))));
  const training = new Map([...rows].filter(([comicId]) => !hidden.has(comicId)));
  splits.set(userId, { training, hidden });
});

const trainingLikes = new Map([...splits].map(([userId, { training }]) => [userId, likesOf(training)]));
// Readers who were not split (too few likes) still count as neighbours, with everything they did.
interactions.forEach((rows, userId) => {
  if (!trainingLikes.has(userId)) trainingLikes.set(userId, likesOf(rows));
});

const popularity = new Map();
trainingLikes.forEach((likes) => likes.forEach((_, comicId) => popularity.set(comicId, (popularity.get(comicId) || 0) + 1)));
const popularRanking = [...popularity].sort((a, b) => b[1] - a[1]).map(([comicId]) => comicId);

const topOf = (scores, known) =>
  [...scores].filter(([comicId]) => !known.has(comicId)).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([comicId]) => comicId);

const METHODS = {
  Popularity: ({ known }) => popularRanking.filter((comicId) => !known.has(comicId)).slice(0, TOP_N),
  CBF: ({ likes, disliked, known }) => topOf(contentScores(likes, disliked, vectors), known),
  CF: ({ likes, others, known }) =>
    topOf(new Map([...userBasedScores(likes, others).scores].map(([comicId, { score }]) => [comicId, score])), known),
  Hybrid: ({ likes, disliked, others, known }) => {
    const { scores: cf, neighbourCount } = userBasedScores(likes, others);
    const cb = contentScores(likes, disliked, vectors);
    const ranked = blend({ cf, cb, neighbourCount, isCandidate: (comicId) => !known.has(comicId) });
    return diversify(ranked.slice(0, TOP_N * 3), (comicId) => mainGenre.get(comicId)).slice(0, TOP_N).map((item) => item.comicId);
  },
};

const totals = Object.fromEntries(Object.keys(METHODS).map((name) => [name, { precision: 0, recall: 0, empty: 0 }]));
splits.forEach(({ training, hidden }, userId) => {
  const likes = trainingLikes.get(userId);
  const disliked = [...training].filter(([, row]) => isDisliked(row)).map(([comicId]) => comicId);
  const known = new Set(training.keys());
  // Neighbour candidates: like the service, other readers sharing at least one liked comic.
  const others = new Map([...trainingLikes].filter(([otherId, theirs]) =>
    otherId !== userId && [...likes.keys()].some((comicId) => theirs.has(comicId))));

  Object.entries(METHODS).forEach(([name, recommend]) => {
    const list = recommend({ likes, disliked, others, known });
    const hits = list.filter((comicId) => hidden.has(comicId)).length;
    totals[name].precision += hits / TOP_N;
    totals[name].recall += hits / hidden.size;
    if (!list.length) totals[name].empty += 1;
  });
});

const n = splits.size;
console.log(`Synthetic data: ${USERS} readers in ${GROUPS} taste groups, ${COMICS} comics, seed ${SEED}.`);
console.log(`Evaluated ${n} readers with at least ${MIN_LIKES} liked comics; ${HIDDEN_SHARE * 100}% of each one's likes hidden.\n`);
console.table(Object.fromEntries(Object.entries(totals).map(([name, t]) => [name, {
  'Precision@10': Number((t.precision / n).toFixed(4)),
  'Recall@10': Number((t.recall / n).toFixed(4)),
  'Empty lists': t.empty,
}])));
