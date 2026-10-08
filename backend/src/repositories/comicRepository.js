// The `comics` table and its many-to-many links (genres, formats, other names).
import { Op, col, fn, literal, where } from 'sequelize';
import { now, sequelize } from '../config/database.js';
import { Artist, Author, Comic, ComicFormat, ComicGenre, ComicOtherName, Format, Genre } from '../models/index.js';

export const findById = (id) => Comic.findByPk(id, { attributes: ['id', 'url', 'coverUrl'], raw: true });

export const findActiveById = (id) => Comic.findOne({ attributes: ['id'], where: { id, deletedAt: null }, raw: true });

export const findStatusById = async (id) => (await Comic.findByPk(id, { attributes: ['status'], raw: true }))?.status;

export const findSummaryById = (id) => Comic.findByPk(id, { attributes: ['id', 'name'], raw: true });

export const findIdByUrl = (url) => Comic.findOne({ attributes: ['id'], where: { url }, raw: true });

export const findOtherWithUrl = (url, excludeId) =>
  Comic.findOne({ attributes: ['id'], where: { url, id: { [Op.ne]: excludeId } }, raw: true });

// Comic columns plus the author's and artist's names.
const findDetail = (whereClause) =>
  Comic.findOne({
    attributes: [
      'id', 'name', 'description', 'types', 'contentRating', 'demographic', 'rating', 'coverUrl', 'view', 'follow',
      'releaseStatus', 'visibility', 'url', 'releasingYear', 'source', 'status',
      [col('author.name'), 'authorName'],
      [col('artist.name'), 'artistName'],
    ],
    include: [
      { model: Author, as: 'author', attributes: [] },
      { model: Artist, as: 'artist', attributes: [] },
    ],
    where: whereClause,
    raw: true,
  });

// Public pages address a comic by id or by its url slug.
const idOrUrl = (key) => ({ [Op.or]: [{ id: key }, { url: key }] });

export const findPublicDetail = (key) => findDetail({ ...idOrUrl(key), visibility: 'public', deletedAt: null });

export const findPublicIdByKey = (key) =>
  Comic.findOne({ attributes: ['id'], where: { ...idOrUrl(key), visibility: 'public', deletedAt: null }, raw: true });

export const findDetailById = (id) => findDetail({ id });

// Genre / format names for many comics at once: [{ comicId, name }].
export const listGenresForComics = (comicIds) =>
  ComicGenre.findAll({
    attributes: ['comicId', [col('genre.name'), 'name']],
    include: [{ model: Genre, as: 'genre', attributes: [], required: true }],
    where: { comicId: comicIds },
    raw: true,
  });

export const listFormatsForComics = (comicIds) =>
  ComicFormat.findAll({
    attributes: ['comicId', [col('format.name'), 'name']],
    include: [{ model: Format, as: 'format', attributes: [], required: true }],
    where: { comicId: comicIds },
    raw: true,
  });

export const listGenreNames = async (comicId) => (await listGenresForComics([comicId])).map((row) => row.name);

export const listFormatNames = async (comicId) => (await listFormatsForComics([comicId])).map((row) => row.name);

export const listOtherNames = (comicId) => ComicOtherName.findAll({ attributes: ['name', 'country'], where: { comicId }, raw: true });

export const listOtherNamesForComics = (comicIds) =>
  ComicOtherName.findAll({ attributes: ['comicId', 'name'], where: { comicId: comicIds }, raw: true });

// ---------- Public catalogue: one query for list, search, popular and top-rated ----------

export const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'name', 'view', 'follow', 'rating'];

const lowerIn = (column, values) => where(fn('lower', col(column)), { [Op.in]: values });

// `filters` comes from the controller, already validated: q (string), and lower-case lists
// contentRatings, types, demographics, releaseStatuses, genres, formats. Empty list = no filter.
function publicWhere({ q, contentRatings = [], types = [], demographics = [], releaseStatuses = [], genres = [], formats = [] } = {}) {
  const conditions = [{ visibility: 'public', deletedAt: null }];
  if (contentRatings.length) conditions.push(lowerIn('contentRating', contentRatings));
  if (types.length) conditions.push(lowerIn('types', types));
  if (demographics.length) conditions.push(lowerIn('demographic', demographics));
  if (releaseStatuses.length) conditions.push(lowerIn('releaseStatus', releaseStatuses));
  if (genres.length) {
    const names = genres.map((name) => sequelize.escape(name)).join(', ');
    conditions.push(literal(
      `Comic.id IN (SELECT cg.comicId FROM comic_genres cg JOIN genres g ON g.id = cg.genreId WHERE lower(g.name) IN (${names}))`
    ));
  }
  if (formats.length) {
    const names = formats.map((name) => sequelize.escape(name)).join(', ');
    conditions.push(literal(
      `Comic.id IN (SELECT cf.comicId FROM comic_formats cf JOIN formats fo ON fo.id = cf.formatId WHERE lower(fo.name) IN (${names}))`
    ));
  }
  if (q) {
    // Name, url, any alternative name, the author or the artist contains q (case-insensitive).
    const like = sequelize.escape(`%${q}%`);
    conditions.push({
      [Op.or]: [
        literal(`lower(Comic.name) LIKE lower(${like})`),
        literal(`lower(Comic.url) LIKE lower(${like})`),
        literal(`EXISTS (SELECT 1 FROM comic_other_names con WHERE con.comicId = Comic.id AND lower(con.name) LIKE lower(${like}))`),
        literal(`EXISTS (SELECT 1 FROM author au WHERE au.id = Comic.authorId AND lower(au.name) LIKE lower(${like}))`),
        literal(`EXISTS (SELECT 1 FROM artist ar WHERE ar.id = Comic.artistId AND lower(ar.name) LIKE lower(${like}))`),
      ],
    });
  }
  return { [Op.and]: conditions };
}

// Without an explicit sort: exact name matches first when searching, otherwise newest first.
function publicOrder(sort, q) {
  const order = sort.length
    ? [...sort]
    : q
      ? [[literal(`CASE WHEN lower(Comic.name) = lower(${sequelize.escape(q)}) THEN 0 ELSE 1 END`), 'ASC'], ['view', 'DESC']]
      : [['createdAt', 'DESC']];
  // A unique last key keeps pages stable when many rows share the same sort value.
  return [...order, ['id', 'ASC']];
}

export const listPublic = ({ filters, sort = [], limit, offset }) =>
  Comic.findAll({
    attributes: [
      'id', 'name', 'url', 'coverUrl', 'description', 'types', 'demographic', 'contentRating', 'releaseStatus',
      'rating', 'view', 'follow', 'createdAt', 'updatedAt',
    ],
    where: publicWhere(filters),
    order: publicOrder(sort, filters?.q),
    limit,
    offset,
    raw: true,
  });

export const countPublic = (filters) => Comic.count({ where: publicWhere(filters) });

export const insert = (comic) => Comic.create({ ...comic, visibility: 'public' });

// Editing a comic sends it back to moderation (status = 'pending').
export const updateAndResubmit = (id, columns) =>
  Comic.update({ ...columns, status: 'pending', updatedAt: now() }, { where: { id } });

export async function replaceGenres(comicId, genreIds) {
  await ComicGenre.destroy({ where: { comicId } });
  await ComicGenre.bulkCreate(genreIds.map((genreId) => ({ comicId, genreId })), { ignoreDuplicates: true });
}

export async function replaceFormats(comicId, formatIds) {
  await ComicFormat.destroy({ where: { comicId } });
  await ComicFormat.bulkCreate(formatIds.map((formatId) => ({ comicId, formatId })), { ignoreDuplicates: true });
}

export const incrementFollowCount = (id) => Comic.increment('follow', { where: { id } });

export const decrementFollowCount = (id) => Comic.update({ follow: literal('MAX(follow - 1, 0)') }, { where: { id } });

export const setRating = (id, rating) => Comic.update({ rating }, { where: { id } });

export const setStatus = (id, status) => Comic.update({ status, updatedAt: now() }, { where: { id } });

export const setVisibility = (id, visibility) => Comic.update({ visibility, updatedAt: now() }, { where: { id } });

// `limit` undefined = no limit.
export const listByStatuses = (statuses, limit) =>
  Comic.findAll({
    attributes: ['id', 'name', 'url', 'coverUrl', 'status', 'createdAt', 'updatedAt'],
    where: { status: { [Op.in]: statuses } },
    order: [['updatedAt', 'DESC']],
    limit,
    raw: true,
  });

export const STAFF_SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'name'];

// Admin / moderation listing: every comic (hidden ones too), filtered by moderation status and visibility.
export const listForStaff = ({ statuses = [], visibilities = [], sort = [], limit, offset }) =>
  Comic.findAndCountAll({
    attributes: ['id', 'name', 'url', 'coverUrl', 'visibility', 'status', 'createdAt', 'updatedAt'],
    where: {
      ...(statuses.length && { status: { [Op.in]: statuses } }),
      ...(visibilities.length && { visibility: { [Op.in]: visibilities } }),
    },
    order: [...(sort.length ? sort : [['updatedAt', 'DESC']]), ['id', 'ASC']],
    limit,
    offset,
    raw: true,
  });
