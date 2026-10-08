import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, CheckCheck, Megaphone } from 'lucide-react';
import { notificationApi } from '../../services/api';
import type { Notification } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getNotificationTab as getTab, isUnread, unreadByTab as groupUnread, type NotificationTab } from '../../helpers/notifications';
import useClickOutside from '../../hooks/useClickOutside';
import cx from '../../helpers/cx';
import styles from './HeaderLayout.module.css';

const MAX_VISIBLE = 6;

export default function NotificationMenu() {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>('comic');
  const [items, setItems] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(rootRef, close, isOpen);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await notificationApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load once on mount so the unread dot is accurate, then refresh whenever opened.
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const unread = items.filter(isUnread);
  const unreadByTab = groupUnread(items);
  const visible = unreadByTab[tab].slice(0, MAX_VISIBLE);

  const markTabRead = async () => {
    const targets = unreadByTab[tab];
    if (targets.length === 0) return;

    setItems((prev) => prev.map((n) => (getTab(n.type) === tab ? { ...n, isRead: 1 } : n)));
    try {
      await Promise.all(targets.map((n) => notificationApi.markRead(n.id)));
    } catch (err) {
      console.error('Unable to mark notifications as read', err);
      load();
    }
  };

  const openNotification = async (noti: Notification) => {
    setItems((prev) => prev.map((n) => (n.id === noti.id ? { ...n, isRead: 1 } : n)));
    try {
      await notificationApi.markRead(noti.id);
    } catch (err) {
      console.error('Unable to mark notification as read', err);
    }
    if (noti.redirectPath?.startsWith('/')) {
      setIsOpen(false);
      navigate(noti.redirectPath);
    }
  };

  const renderList = () => {
    if (isLoading && items.length === 0) {
      return <li className={styles.popEmpty}>Loading…</li>;
    }

    if (error) {
      return (
        <li className={styles.popEmpty}>
          <strong>Unable to load notifications</strong>
          <span>{error}</span>
        </li>
      );
    }

    if (visible.length === 0) {
      return (
        <li className={styles.popEmpty}>
          <Bell size={22} className={styles.popEmptyIcon} />
          <strong>No new {tab} notifications</strong>
          <span>You&apos;re all caught up.</span>
        </li>
      );
    }

    return visible.map((noti) => {
      const kind = getTab(noti.type);
      return (
        <li key={noti.id}>
          <button type="button" className={styles.notif} onClick={() => openNotification(noti)}>
            <span className={cx(styles.notifIcon, kind === 'system' && styles.notifIconSystem)}>
              {kind === 'system' ? <Megaphone size={14} /> : <Bell size={14} />}
            </span>
            <span className={styles.notifBody}>
              <span className={styles.notifTitle}>{noti.title}</span>
              <span className={cx(styles.notifTime, 'mono')}>
                {formatTimeAgo(noti.createdAt)}
                {noti.redirectPath?.includes('/chapter') ? ' · Chapter' : ''}
              </span>
            </span>
          </button>
        </li>
      );
    });
  };

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={cx(styles.iconBtn, isOpen && styles.iconBtnActive)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        title="Notifications"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread.length > 0 ? <span className={styles.dot} aria-hidden="true" /> : null}
      </button>

      {isOpen ? (
        <div className={cx(styles.pop, styles.notifPop)} role="dialog" aria-label="Notifications">
          <div className={styles.popHead}>
            <div>
              <h3 className={styles.popTitle}>Notifications</h3>
              <span className={styles.popSub}>
                {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
              </span>
            </div>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={unreadByTab[tab].length === 0}
              onClick={markTabRead}
            >
              <CheckCheck size={14} />
              Mark read
            </button>
          </div>

          <div className={styles.segment} role="tablist">
            {(['comic', 'system'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={cx(styles.segmentBtn, tab === key && styles.segmentBtnOn)}
                onClick={() => setTab(key)}
              >
                {key === 'comic' ? 'Comics' : 'System'}
                {unreadByTab[key].length > 0 ? (
                  <span className={styles.count}>{unreadByTab[key].length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <ul className={styles.notifList}>{renderList()}</ul>

          <Link to="/profile?tab=notifications" className={styles.popFooter} onClick={close}>
            <span>View all notifications</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
