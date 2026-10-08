import { Op } from 'sequelize';
import { now } from '../config/database.js';
import { Chapter, ChapterImage, Comic } from '../models/index.js';

const STAFF_COLUMNS = ['id', 'comicId', 'title', 'chapterNumber', 'url', 'visibility', 'status', 'createdAt', 'updatedAt'];
const PUBLIC = { visibility: 'public', deletedAt: null };

export const findById = (id) => Chapter.findByPk(id, { attributes: ['id', 'comicId', 'title'], raw: true });

export const findStatusById = async (id) => (await Chapter.findByPk(id, { attributes: ['status'], raw: true }))?.status;

export const findIdByUrl = (url) => Chapter.findOne({ attributes: ['id'], where: { url }, raw: true });

// Staff can open any chapter; everyone else only public, non-deleted chapters of public comics.
export const findReadable = (id, isStaff) =>
  Chapter.findOne({
    attributes: ['id', 'chapterNumber', 'title'],
    where: isStaff ? { id } : { id, ...PUBLIC },
    include: [{ model: Comic, as: 'comic', attributes: [], required: true, where: isStaff ? undefined : PUBLIC }],
    raw: true,
  });

export const SORTABLE_FIELDS = ['chapterNumber', 'createdAt', 'updatedAt'];

export const listPublicByComic = (comicId, { sort = [], limit, offset }) =>
  Chapter.findAndCountAll({
    attributes: ['id', 'chapterNumber', 'title', 'url', 'createdAt', 'updatedAt'],
    where: { comicId, ...PUBLIC },
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
        where: { comicId: comicIds, visibility: 'public' },
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
export const listForStaff = ({ statuses = [], visibilities = [], sort = [], limit, offset }) =>
  Chapter.findAndCountAll({
    attributes: STAFF_COLUMNS,
    where: {
      ...(statuses.length && { status: { [Op.in]: statuses } }),
      ...(visibilities.length && { visibility: { [Op.in]: visibilities } }),
    },
    order: [...(sort.length ? sort : [['updatedAt', 'DESC']]), ['id', 'ASC']],
    limit,
    offset,
    raw: true,
  });
