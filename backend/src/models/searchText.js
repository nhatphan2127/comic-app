// Accent- and case-insensitive search ("kiem" finds "Kiếm", "KIẾM" finds "kiếm").
//
// SQLite's lower() only knows ASCII and it has no unaccent(), so every comic keeps a folded copy of what
// the catalogue search looks at in comics.searchText:
//   fold(name) SEP fold(url) SEP fold(other names) SEP fold(author) SEP fold(artist)
// Triggers rebuild it whenever one of those changes, whoever writes (services, seed script, raw SQL).
// The query side folds `q` with foldText(), which applies exactly the same mapping in JS.
import { sequelize } from '../config/database.js';

// Separates the fields, so a match never spans two of them. The name comes first: `searchText LIKE 'q%'`
// means "the name starts with q" and `searchText LIKE 'q' || SEP || '%'` means "the name is q".
export const SEP_SQL = 'char(31)';

// Accented letters folded to their base letter: Vietnamese, plus the common Western European ones.
const LOWER = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ' + 'äëïöüÿçñ';
const FOLDS = [...LOWER, ...LOWER.toUpperCase()]
  .map((ch) => [ch, ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()])
  .concat([['đ', 'd'], ['Đ', 'd']]);
// Text stored decomposed (letter + combining mark, as some editors save it) loses its marks.
const MARKS = ['̀', '́', '̂', '̃', '̆', '̈', '̉', '̛', '̣', '̧'];

// The same mapping in JS. Only A-Z are lower-cased, like SQLite's lower(), so both sides always agree.
const FOLD_MAP = new Map(FOLDS);
export const foldText = (text) =>
  [...text.normalize('NFC')]
    .map((ch) => FOLD_MAP.get(ch) ?? (MARKS.includes(ch) ? '' : ch))
    .join('')
    .replace(/[A-Z]/g, (ch) => ch.toLowerCase());

// `q` folded and escaped for `LIKE ... ESCAPE '\'`, so % and _ typed by the user are plain characters.
export const likeText = (q) => foldText(q).replace(/[\\%_]/g, (ch) => `\\${ch}`);

// ---------- Keeping comics.searchText up to date ----------

const quote = (text) => `'${text.replace(/'/g, "''")}'`;

// The searchable fields of a comics row, separated by SEP.
const RAW_TEXT = [
  'comics.name',
  'comics.url',
  "(SELECT group_concat(con.name, ' ') FROM comic_other_names con WHERE con.comicId = comics.id)",
  '(SELECT au.name FROM author au WHERE au.id = comics.authorId)',
  '(SELECT ar.name FROM artist ar WHERE ar.id = comics.artistId)',
].map((field) => `coalesce(${field}, '')`).join(` || ${SEP_SQL} || `);

// SQLite's parser rejects deeply nested expressions ("parser stack overflow"), so the folding runs as
// several UPDATEs in a row, each applying this many replace() calls to searchText.
const REPLACES_PER_STATEMENT = 20;
const STEPS = [...FOLDS, ...MARKS.map((mark) => [mark, ''])];

const replaceChain = (expr, steps) =>
  steps.reduce((sql, [from, to]) => `replace(${sql}, ${quote(from)}, ${quote(to)})`, expr);

// Statements rebuilding searchText for the rows matching `where`: copy the raw text, fold accented
// letters and combining marks chunk by chunk, then lower() (ASCII only, like foldText).
function refreshStatements(where) {
  const statements = [`UPDATE comics SET searchText = ${RAW_TEXT} WHERE ${where};`];
  for (let i = 0; i < STEPS.length; i += REPLACES_PER_STATEMENT) {
    const chunk = STEPS.slice(i, i + REPLACES_PER_STATEMENT);
    statements.push(`UPDATE comics SET searchText = ${replaceChain('searchText', chunk)} WHERE ${where};`);
  }
  statements.push(`UPDATE comics SET searchText = lower(searchText) WHERE ${where};`);
  return statements;
}

const triggerBody = (where) => `BEGIN ${refreshStatements(where).join(' ')} END`;

const TRIGGERS = {
  comics_search_insert: `AFTER INSERT ON comics ${triggerBody('id = NEW.id')}`,
  comics_search_update: `AFTER UPDATE OF name, url, authorId, artistId ON comics ${triggerBody('id = NEW.id')}`,
  other_names_search_insert: `AFTER INSERT ON comic_other_names ${triggerBody('id = NEW.comicId')}`,
  other_names_search_update: `AFTER UPDATE ON comic_other_names ${triggerBody('id IN (OLD.comicId, NEW.comicId)')}`,
  other_names_search_delete: `AFTER DELETE ON comic_other_names ${triggerBody('id = OLD.comicId')}`,
  author_search_update: `AFTER UPDATE OF name ON author ${triggerBody('authorId = NEW.id')}`,
  artist_search_update: `AFTER UPDATE OF name ON artist ${triggerBody('artistId = NEW.id')}`,
};

// Called at startup, after the searchText column exists. Triggers are recreated and every row rebuilt,
// so a change to the folding above applies to existing data on the next start.
export async function installSearchText() {
  for (const [name, definition] of Object.entries(TRIGGERS)) {
    await sequelize.query(`DROP TRIGGER IF EXISTS ${name}`);
    await sequelize.query(`CREATE TRIGGER ${name} ${definition}`);
  }
  for (const statement of refreshStatements('1 = 1')) await sequelize.query(statement);
}
