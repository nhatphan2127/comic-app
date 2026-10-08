import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Megaphone } from 'lucide-react';
import type { Notification } from '../../../../types/types';
import { notificationApi } from '../../../../services/api';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import { getNotificationTab, isUnread, unreadByTab, type NotificationTab } from '../../../../helpers/notifications';
import Segmented from '../../../../components/Segmented/Segmented';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import cx from '../../../../helpers/cx';
import style from './NotificationsPanel.module.css';

type Filter = 'all' | 'unread';

export default function NotificationsPanel() {
  const [tab, setTab] = useState<NotificationTab>('comic');
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await notificationApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unread = unreadByTab(items);
  const visible = items.filter(
    (n) => getNotificationTab(n.type) === tab && (filter === 'all' || isUnread(n)),
  );

  const markAllRead = async () => {
    const targets = unread[tab];
    if (targets.length === 0) return;
    setItems((prev) => prev.map((n) => (getNotificationTab(n.type) === tab ? { ...n, isRead: 1 } : n)));
    try {
      await Promise.all(targets.map((n) => notificationApi.markRead(n.id)));
    } catch (err) {
      console.error('Unable to mark notifications as read:', err);
      load();
    }
  };

  const open = async (noti: Notification) => {
    setItems((prev) => prev.map((n) => (n.id === noti.id ? { ...n, isRead: 1 } : n)));
    notificationApi.markRead(noti.id).catch(() => undefined);
    // In-app paths open without reloading the page.
    if (noti.redirectPath?.startsWith('/')) navigate(noti.redirectPath);
  };

  return (
    <PanelShell
      title="Notifications"
      subtitle={`${unread.comic.length + unread.system.length} unread`}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" disabled={unread[tab].length === 0} onClick={markAllRead}>
          <CheckCheck size={14} />
          Mark all read
        </button>
      }
    >
      <div className={style.filters}>
        <Segmented
          ariaLabel="Notification type"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'comic', label: 'Comics', count: unread.comic.length },
            { value: 'system', label: 'System', count: unread.system.length },
          ]}
        />
        <Segmented
          ariaLabel="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ]}
        />
      </div>

      <PanelState
        loading={loading}
        error={error}
        empty={visible.length === 0}
        emptyTitle="You're all caught up"
        emptyText={`No ${filter === 'unread' ? 'unread ' : ''}${tab} notifications.`}
      >
        <ul className={style.list}>
          {visible.map((noti) => {
            const unreadItem = isUnread(noti);
            const system = getNotificationTab(noti.type) === 'system';
            return (
              <li key={noti.id}>
                <button type="button" className={cx(style.row, unreadItem && style.unread)} onClick={() => open(noti)}>
                  <span className={cx(style.icon, system && style.iconSystem)}>
                    {system ? <Megaphone size={16} /> : <Bell size={16} />}
                  </span>
                  <span className={style.body}>
                    <span className={style.title}>{noti.title}</span>
                    {noti.content ? <span className={style.content}>{noti.content}</span> : null}
                    <span className={style.time}>{formatTimeAgo(noti.createdAt)}</span>
                  </span>
                  {unreadItem ? <span className={style.dot} aria-label="Unread" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PanelState>
    </PanelShell>
  );
}
