// Column shortcuts shared by every model. All ids are UUID strings stored as TEXT.
import { DataTypes } from 'sequelize';
import { now } from '../config/database.js';

export const { TEXT, INTEGER, REAL } = DataTypes;

export const primaryId = { type: TEXT, primaryKey: true };

// `references` is the table name, e.g. ref('users') → FOREIGN KEY ... REFERENCES users(id).
export const ref = (table, { allowNull = false, primaryKey = false } = {}) => ({
  type: TEXT,
  allowNull,
  primaryKey,
  references: { model: table, key: 'id' },
});

export const timestamp = () => ({ type: TEXT, defaultValue: now() });

export const withDefault = (type, defaultValue) => ({ type, defaultValue });

export const required = (type) => ({ type, allowNull: false });
