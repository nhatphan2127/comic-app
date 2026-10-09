import { Op, col } from 'sequelize';
import { now } from '../config/database.js';
import { Chapter, ChapterImage, Comic } from '../models/index.js';
import { READABLE } from './visibility.js';

const STAFF_COLUMNS = ['id', 'comicId', 'title', 'chapterNumber', 'url', 'visibility', 'status', 'createdAt', 'updatedAt'];

export const findById = (id) => Chapter.findByPk(id, { attributes: ['id', 'comicId', 'title'], raw: true });

export const findStatusById = async (id) => (await Chapter.findByPk(id, { attributes: ['status'], raw: true }))?.status;

// A chapter with this number that still counts (not deleted, not rejected), to refuse duplicates.
export const findLiveByNumber = (comicId, chapterNumber) =>
  Chapter.findOne({
    attributes: ['id', 'status'],
    where: { comicId, chapterNumber, deletedAt: null, status: { [Op.ne]: 'reject' } },
    raw: true,
  });

export const findIdByUrl = (url) => Chapter.findOne({ attributes: ['id'], where: { url }, raw: true });

// A chapter readers may open or act on: readable itself and in a readable comic, whatever the user's role.
export const findReadable = (id) =>
  Chapter.findOne({
    attributes: ['id', 'chapterNumber', 'title'],
    where: { id, ...READABLE },
    include: [{ model: Comic, as: 'comic', attributes: [], required: true, where: READABLE }],
    raw: true,
  });

// The moderation preview: any chapter, whatever its review state or visibility.
export const findForReview = (id) =>
  Chapter.findByPk(id, { attributes: ['id', 'comicId', 'chapterNumber', 'title', 'status', 'visibility'], raw: true });

export const SORTABLE_FIELDS = ['chapterNumber', 'createdAt', 'updatedAt'];

export const listPublicByComic = (comicId, { sort = [], limit, offset }) =>
  Chapter.findAndCountAll({
    attributes: ['id', 'chapterNumber', 'title', 'url', 'createdAt', 'updatedAt'],
    where: { comicId, ...READABLE },
    order: [...(sort.length ? sort : [['chapterNumber', 'ASC']]), ['id', 'ASC']],
    limit,
    offset,
    raw: true,
  });

// Public chapters of many comics, newest first per comic (for "latest chapters" in lists).
export const listPublicForComics = async (comicIds) =>
  comicIds.length
    ? Chapter.findAll({
        attributes: ['comicId', 'id', 'chapterNumber', 'title', 'updatedAt'],
        where: { comicId: comicIds, ...READABLE },
        order: [['comicId'], ['chapterNumber', 'DESC']],
        raw: true,
      })
    : [];

export const listImages = (chapterId) =>
  ChapterImage.findAll({ attributes: ['pageNumber', 'urlPath'], where: { chapterId }, order: [['pageNumber', 'ASC']], raw: true });

export const insert = ({ id, comicId, title, chapterNumber, url, status }) =>
  Chapter.create({ id, comicId, title, chapterNumber, url, status, visibility: 'public' });

export const insertImages = (images) => ChapterImage.bulkCreate(images);

export const setStatus = (id, status) => Chapter.update({ status, updatedAt: now() }, { where: { id } });

export const setVisibility = (id, visibility) => Chapter.update({ visibility, updatedAt: now() }, { where: { id } });

// `limit` undefined = no limit.
export const listByStatuses = (statuses, limit) =>
  Chapter.findAll({
    attributes: ['id', 'comicId', 'title', 'chapterNumber', 'url', 'status', 'createdAt', 'updatedAt'],
    where: { status: { [Op.in]: statuses } },
    order: [['updatedAt', 'DESC']],
    limit,
    raw: true,
  });

export const STAFF_SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'chapterNumber'];

// Admin / moderation listing: every chapter, filtered by moderation status and visibility.
// `q` matches the chapter title or its comic's name; each row carries the comic's name and url.
export const listForStaff = ({ q = '', statuses = [], visibilities = [], sort = [], limit, offset }) =>
  Chapter.findAndCountAll({
    attributes: [...STAFF_COLUMNS, [col('comic.name'), 'comicName'], [col('comic.url'), 'comicUrl']],
    include: [{ model: Comic, as: 'comic', attributes: [] }],
    where: {
      ...(statuses.length && { status: { [Op.in]: statuses } }),
      ...(visibilities.length && { visibility: { [Op.in]: visibilities } }),
      ...(q && { [Op.or]: [{ title: { [Op.like]: `%${q}%` } }, { '$comic.name$': { [Op.like]: `%${q}%` } }] }),
    },
    order: [...(sort.length ? sort.map(([field, dir]) => [col(`Chapter.${field}`), dir]) : [[col('Chapter.updatedAt'), 'DESC']]), [col('Chapter.id'), 'ASC']],
    limit,
    offset,
    raw: true,
  });
