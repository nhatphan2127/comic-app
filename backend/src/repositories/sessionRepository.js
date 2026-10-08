import { v4 as uuidv4 } from 'uuid';
import { Op, col } from 'sequelize';
import { Session, User } from '../models/index.js';

// Session joined with its (non-banned) user.
export const findWithUserByToken = (token) =>
  Session.findOne({
    attributes: [
      'id', 'userId', 'token', 'createdAt', 'expiresAt',
      [col('user.username'), 'username'],
      [col('user.displayName'), 'displayName'],
      [col('user.email'), 'email'],
      [col('user.avatar'), 'avatar'],
      [col('user.role'), 'role'],
    ],
    include: [{
      model: User,
      as: 'user',
      attributes: [],
      required: true,
      where: { [Op.or]: [{ isBanned: 0 }, { isBanned: null }] },
    }],
    where: { token },
    raw: true,
  });

export const insert = ({ userId, token, expiresAt }) => Session.create({ id: uuidv4(), userId, token, expiresAt });

export const removeByToken = (token) => Session.destroy({ where: { token } });

export const removeAllForUser = (userId) => Session.destroy({ where: { userId } });

export const removeOthers = (userId, keepToken) => Session.destroy({ where: { userId, token: { [Op.ne]: keepToken } } });
