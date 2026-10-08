// following_categories: rows with userId IS NULL are shared defaults, the rest belong to one user.
import { Op, col, fn, literal, where } from 'sequelize';
import { FollowingCategory } from '../models/index.js';

const ownedOrDefault = (userId) => ({ [Op.or]: [{ userId: null }, { userId }] });

export const findOwnedOrDefault = (id, userId) =>
  FollowingCategory.findOne({ attributes: ['id'], where: { id, ...ownedOrDefault(userId) }, raw: true });

export const findOwned = (id, userId) => FollowingCategory.findOne({ attributes: ['id'], where: { id, userId }, raw: true });

export const findByNameVisibleTo = (name, userId) =>
  FollowingCategory.findOne({
    attributes: ['id'],
    where: { [Op.and]: [where(fn('lower', col('category')), fn('lower', name)), ownedOrDefault(userId)] },
    raw: true,
  });

// Shared defaults first, then the user's own categories, each alphabetically.
export const listVisibleTo = (userId) =>
  FollowingCategory.findAll({
    attributes: ['id', 'category', 'userId'],
    where: ownedOrDefault(userId),
    order: [literal('CASE WHEN userId IS NULL THEN 0 ELSE 1 END'), 'category'],
    raw: true,
  });

export const insert = ({ id, name, userId }) => FollowingCategory.create({ id, category: name, userId });

export const rename = (id, userId, name) => FollowingCategory.update({ category: name }, { where: { id, userId } });

export const remove = (id, userId) => FollowingCategory.destroy({ where: { id, userId } });
