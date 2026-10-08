import { sequelize } from '../config/database.js';
import { TEXT, INTEGER, primaryId, ref, timestamp, withDefault, required } from './columns.js';

export const Notification = sequelize.define('Notification', {
  id: primaryId,
  userId: ref('users'),
  title: required(TEXT),
  content: required(TEXT),
  type: required(TEXT),
  redirectPath: TEXT,
  isRead: withDefault(INTEGER, 0),
  createdAt: timestamp(),
}, { tableName: 'notifications' });

export const AdminSetting = sequelize.define('AdminSetting', {
  key: { type: TEXT, primaryKey: true },
  value: required(TEXT),
  updatedAt: timestamp(),
}, { tableName: 'admin_settings' });

// A reader flagging a comic or a comment for moderators to look at.
export const Report = sequelize.define('Report', {
  id: primaryId,
  userId: ref('users'),
  targetType: required(TEXT), // comic, comment
  targetId: required(TEXT),
  reason: required(TEXT),
  details: TEXT,
  status: withDefault(TEXT, 'open'), // open, resolved, dismissed
  resolvedBy: ref('users', { allowNull: true }),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, {
  tableName: 'reports',
  indexes: [
    { name: 'idx_reports_status', fields: ['status'] },
    { name: 'idx_reports_target', fields: ['targetType', 'targetId'] },
  ],
});

// Not used by the API yet; kept so the schema stays complete.
export const EditRequest = sequelize.define('EditRequest', {
  id: primaryId,
  userId: ref('users'),
  targetType: required(TEXT), // comic, chapter, author, artist
  targetId: required(TEXT),
  proposedChanges: required(TEXT), // JSON
  status: withDefault(TEXT, 'pending'), // pending, approved, rejected
  moderatorId: ref('users', { allowNull: true }),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'edit_requests', indexes: [{ name: 'idx_edit_requests_status', fields: ['status'] }] });

export const ModerationLog = sequelize.define('ModerationLog', {
  id: primaryId,
  moderatorId: ref('users'),
  action: required(TEXT), // approve, reject, hide, delete
  targetType: required(TEXT), // comic, chapter, comment, edit_request
  targetId: required(TEXT),
  reason: TEXT,
  createdAt: timestamp(),
}, { tableName: 'moderation_logs' });
