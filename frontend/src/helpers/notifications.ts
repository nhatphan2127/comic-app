import type { Notification } from '../types/types';

export type NotificationTab = 'comic' | 'system';

export const getNotificationTab = (type: string): NotificationTab =>
  (type || '').toLowerCase().includes('system') ? 'system' : 'comic';

export const isUnread = (n: Notification) => n.isRead === 0;

/** Unread notifications grouped by tab. */
export const unreadByTab = (items: Notification[]): Record<NotificationTab, Notification[]> => {
  const unread = items.filter(isUnread);
  return {
    comic: unread.filter((n) => getNotificationTab(n.type) === 'comic'),
    system: unread.filter((n) => getNotificationTab(n.type) === 'system'),
  };
};
