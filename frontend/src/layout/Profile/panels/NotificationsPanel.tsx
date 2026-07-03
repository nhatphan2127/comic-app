import { useEffect, useState, useCallback } from 'react';
import type { Notification } from '../../../types/data';
import { notificationApi, API_UPLOADS } from '../../../services/api';
import { formatTimeAgo } from '../../../helpers/formatDate';

const getNotificationType = (type: string): 'comic' | 'system' => {
  const t = (type || '').toString().toLowerCase();
  if (t.includes('system')) return 'system';
  return 'comic';
};

const isUnread = (noti: Notification): boolean => noti.isRead === 0;

export default function NotificationsPanel() {
  // Bộ lọc Tab (Comic / system) và Filter (All / Unread)
  const [activeTab, setActiveTab] = useState<'comic' | 'system'>('comic');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  // Danh sách dữ liệu thông báo trực tiếp dùng type Notification
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm tải danh sách thông báo từ server
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await notificationApi.list();
      setNotifications(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  // Tính toán số lượng chưa đọc riêng biệt
  const comicUnreadCount = notifications.filter(
    n => isUnread(n) && getNotificationType(n.type) === 'comic'
  ).length;

  const systemUnreadCount = notifications.filter(
    n => isUnread(n) && getNotificationType(n.type) === 'system'
  ).length;

  const totalUnreadCount = comicUnreadCount + systemUnreadCount;
  const currentTabUnreadCount = activeTab === 'comic' ? comicUnreadCount : systemUnreadCount;

  // Lọc danh sách hiển thị theo Tab và Filter được chọn
  const filteredNotifications = notifications.filter(noti => {
    const matchesTab = getNotificationType(noti.type) === activeTab;
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && isUnread(noti));
    return matchesTab && matchesFilter;
  });

  // Xử lý đánh dấu đã đọc tất cả thuộc tab hiện tại
  const handleMarkAllRead = async () => {
    const unreadInCurrentTab = notifications.filter(
      n => isUnread(n) && getNotificationType(n.type) === activeTab
    );
    if (unreadInCurrentTab.length === 0) return;

    // 1. Cập nhật giao diện cục bộ ngay lập tức (Optimistic UI)
    setNotifications(prev => 
      prev.map(n => getNotificationType(n.type) === activeTab ? { ...n, isRead: 1 } : n)
    );

    try {
      // 2. Gửi request đồng loạt lên server để cập nhật trạng thái
      await Promise.all(unreadInCurrentTab.map(n => notificationApi.markRead(n.id)));
    } catch (err) {
      console.error('Lỗi khi đánh dấu đã đọc:', err);
    } finally {
      // 3. Tải lại dữ liệu mới nhất từ server để đồng bộ và render lại chính xác
      await loadNotifications();
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <div className="user-content">
      <div className="uview">
        {/* Phần đầu Tiêu đề & Công cụ */}
        <div className="uview__head uview__head--row">
          <div>
            <h2 className="uview__title">Notifications</h2>
            <p className="uview__sub">{totalUnreadCount} unread total.</p>
          </div>
          <div className="uview__head-tools">
            <button 
              type="button" 
              className="ubtn ubtn--ghost ubtn--sm"
              disabled={currentTabUnreadCount === 0} // Vô hiệu hóa nút khi tab hiện tại không có thông báo chưa đọc
              onClick={handleMarkAllRead}
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.8" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                aria-hidden="true"
              >
                <path d="M4 12l5 5L20 6"></path>
              </svg> 
              Mark all read
            </button>
          </div>
        </div>

        {/* Thanh Bộ lọc (Filters) */}
        <div className="nfilters">
          <div className="useg">
            <button 
              type="button"
              className={`useg__btn ${activeTab === 'comic' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('comic')}
            >
              <span>Comic</span>
              {comicUnreadCount > 0 && (
                <span className="useg__count mono">{comicUnreadCount}</span>
              )}
            </button>
            <button 
              type="button"
              className={`useg__btn ${activeTab === 'system' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <span>System</span>
              {systemUnreadCount > 0 && (
                <span className="useg__count mono">{systemUnreadCount}</span>
              )}
            </button>
          </div>
          <div className="useg">
            <button 
              type="button"
              className={`useg__btn ${activeFilter === 'all' ? 'is-on' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
            <button 
              type="button"
              className={`useg__btn ${activeFilter === 'unread' ? 'is-on' : ''}`}
              onClick={() => setActiveFilter('unread')}
            >
              Unread
            </button>
          </div>
        </div>

        {/* Kiểm tra điều kiện hiển thị danh sách hoặc trạng thái trống */}
        {loading ? (
          <div className="uempty">Loading...</div>
        ) : error ? (
          <div className="uempty">{error}</div>
        ) : filteredNotifications.length > 0 ? (
          <ul className="nlist">
            {filteredNotifications.map((noti) => {
              const notificationUnread = isUnread(noti);
              const notificationType = getNotificationType(noti.type);
              const redirectHref = noti.redirectPath || '#';

              return (
                <li
                  key={noti.id}
                  className={`nrow ${notificationUnread ? 'is-unread' : ''} is-clickable`}
                  onClick={async () => {
                    try {
                      // Đánh dấu đã đọc cục bộ (Optimistic UI) bằng cách gán isRead = 1
                      setNotifications(prev =>
                        prev.map(n => n.id === noti.id ? { ...n, isRead: 1 } : n)
                      );
                      await notificationApi.markRead(noti.id);
                    } catch (_) {
                      // Bỏ qua lỗi nếu có để không gián đoạn trải nghiệm người dùng
                    }
                    
                    // Chuyển tab theo loại thông báo và chuyển hướng
                    setActiveTab(notificationType);
                    if (redirectHref && redirectHref !== '#') {
                      window.location.assign(redirectHref);
                    }
                  }}
                >
                  {/* Icon Chuông báo */}
                  <div className="nrow__icon nrow__icon--reply">
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="1.8" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      aria-hidden="true"
                    >
                      <path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3z"></path>
                      <path d="M10 20a2 2 0 0 0 4 0"></path>
                    </svg>
                  </div>

                  {/* Nội dung thông báo */}
                  <div className="nrow__body">
                    <div className="nrow__text">
                      <b>{noti.title}</b>
                    </div>
                    <div className="nrow__meta">
                      <span>{formatTimeAgo(noti.createdAt)}</span>
                    </div>
                  </div>

                  {/* Poster ảnh thu nhỏ */}
                  <a 
                    className="nrow__poster" 
                    href={redirectHref} 
                    aria-hidden="true" 
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="poster poster--xs">
                      <img alt="" loading="lazy" src={API_UPLOADS + 'comic/default-cover.jpg'} />
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          /* Giao diện trạng thái trống (Empty State) */
          <div className="uempty">
            <div className="uempty__icon">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.8" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                aria-hidden="true"
              >
                <path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3z"></path>
                <path d="M10 20a2 2 0 0 0 4 0"></path>
              </svg>
            </div>
            <div className="uempty__title">Nothing here.</div>
            <div className="uempty__sub">
              {activeTab === 'comic' 
                ? 'No comic notifications yet.' 
                : 'No system notifications yet.'
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}