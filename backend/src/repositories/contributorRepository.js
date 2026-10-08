// comic_contributors and chapter_contributors have the same shape; `type` picks the model.
import { col } from 'sequelize';
import { now } from '../config/database.js';
import { Chapter, ChapterContributor, Comic, ComicContributor, User } from '../models/index.js';
import { BadRequestError } from '../errors.js';

const TARGETS = {
  comic: { Contributor: ComicContributor, fk: 'comicId' },
  chapter: { Contributor: ChapterContributor, fk: 'chapterId' },
};

function target(type) {
  const t = TARGETS[type];
  if (!t) throw new BadRequestError('Unsupported target type');
  return t;
}

export const isContributor = async (type, targetId, userId) => {
  const t = target(type);
  return (await t.Contributor.count({ where: { [t.fk]: targetId, userId } })) > 0;
};

export const insertIgnore = (type, { targetId, userId, role = 'uploader', status }) => {
  const t = target(type);
  return t.Contributor.bulkCreate([{ [t.fk]: targetId, userId, role, status }], { ignoreDuplicates: true });
};

export const setStatusForUser = (type, targetId, userId, status) => {
  const t = target(type);
  return t.Contributor.update({ status, updatedAt: now() }, { where: { [t.fk]: targetId, userId } });
};

export const setStatusForTarget = (type, targetId, status) => {
  const t = target(type);
  return t.Contributor.update({ status, updatedAt: now() }, { where: { [t.fk]: targetId } });
};

export const listForTarget = (type, targetId) => {
  const t = target(type);
  return t.Contributor.findAll({
    attributes: [
      [col(t.fk), 'targetId'], 'userId', 'role', 'status', 'unread', 'createdAt', 'updatedAt',
      [col('user.displayName'), 'displayName'],
      [col('user.avatar'), 'avatar'],
    ],
    include: [{ model: User, as: 'user', attributes: [] }],
    where: { [t.fk]: targetId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });
};

const CONTRIBUTION_COLUMNS = ['userId', 'role', 'status', 'unread', 'createdAt', 'updatedAt'];

export const listComicContributionsOfUser = (userId) =>
  ComicContributor.findAll({
    attributes: [
      'comicId', ...CONTRIBUTION_COLUMNS,
      [col('comic.id'), 'id'], [col('comic.name'), 'name'], [col('comic.coverUrl'), 'coverUrl'],
      [col('comic.url'), 'url'], [col('comic.types'), 'types'], [col('comic.demographic'), 'demographic'],
    ],
    include: [{ model: Comic, as: 'comic', attributes: [], required: true }],
    where: { userId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });

export const listChapterContributionsOfUser = (userId) =>
  ChapterContributor.findAll({
    attributes: [
      'chapterId', ...CONTRIBUTION_COLUMNS,
      [col('chapter.id'), 'id'], [col('chapter.chapterNumber'), 'chapterNumber'], [col('chapter.title'), 'title'],
      [col('chapter.url'), 'url'], [col('chapter.comicId'), 'comicId'],
      [col('chapter->comic.name'), 'comicName'], [col('chapter->comic.coverUrl'), 'comicCoverUrl'],
    ],
    include: [{
      model: Chapter,
      as: 'chapter',
      attributes: [],
      required: true,
      include: [{ model: Comic, as: 'comic', attributes: [], required: true }],
    }],
    where: { userId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });
