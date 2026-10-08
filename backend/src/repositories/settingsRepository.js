import { now } from '../config/database.js';
import { AdminSetting } from '../models/index.js';

export const get = async (key) => (await AdminSetting.findByPk(key, { raw: true }))?.value ?? null;

export const set = (key, value) => AdminSetting.upsert({ key, value, updatedAt: now() });
