import { useState, useEffect, useRef, useMemo, type FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Settings from './Settings';
import AuthModal from './AuthModal';
import { comicApi, notificationApi, API_UPLOADS, type ComicSearchResult } from '../services/api';
import type { Notification } from '../types/types';
import { formatTimeAgo } from '../helpers/formatDate';

// Import các icon bổ sung nếu cần dùng trong dropdown
import {
  User, Bookmark, History, Bell, Settings as SettingsIcon, MessageSquare,  LogOut,
  Search, X, ChevronRight, Menu, Check
} from 'lucide-react';

export default function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [searchResults, setSearchResults] = useState<ComicSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isNotification, setNotification] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationTab, setNotificationTab] = useState<'comic' | 'system'>('comic');
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const avatarLetter = useMemo(() => {
    return user?.displayName?.[0] || user?.userName?.[0] || 'U';
  }, [user]);

  const handleTabClick = (tabId: string) => {
    setIsDropdownOpen(false);
    navigate(`/profile?tab=${tabId}`);
  };

  const getNotificationType = (type: string): 'comic' | 'system' => {
    const t = (type || '').toString().toLowerCase();
    return t.includes('system') ? 'system' : 'comic';
  };

  const isUnread = (noti: Notification): boolean => noti.isRead === 0;

  const loadNotifications = useCallback(async () => {
    if (!isLoggedIn) return;

    setIsNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const items = await notificationApi.list();
      setNotifications(items);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications');
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && isNotification) {
      loadNotifications();
    }
  }, [isLoggedIn, isNotification, loadNotifications]);

  useEffect(() => {
    const trimmed = searchVal.trim();

    if (!trimmed || !isSearchOpen) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    let ignore = false;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const results = await comicApi.search(trimmed);
        if (!ignore) {
          setSearchResults(results);
          setIsSearching(false);
          setSearchError(null);
        }
      } catch (error) {
        if (!ignore) {
          setSearchResults([]);
          setIsSearching(false);
          setSearchError(error instanceof Error ? error.message : 'Unable to load search results');
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [isSearchOpen, searchVal]);

  useEffect(() => {
    if (!isSearchOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (searchFormRef.current && !searchFormRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setNotification(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Xử lý gửi form tìm kiếm
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = searchVal.trim();
    if (query) {
      navigate(`/browse?search=${encodeURIComponent(query)}`);
      setIsSearchOpen(false);
    }
  };

  const comicUnreadCount = notifications.filter((n) => isUnread(n) && getNotificationType(n.type) === 'comic').length;
  const systemUnreadCount = notifications.filter((n) => isUnread(n) && getNotificationType(n.type) === 'system').length;
  const unreadCount = comicUnreadCount + systemUnreadCount;
  const currentTabUnreadCount = notificationTab === 'comic' ? comicUnreadCount : systemUnreadCount;
  const visibleNotifications = notifications
    .filter((n) => getNotificationType(n.type) === notificationTab && isUnread(n))
    .slice(0, 6);

  const handleMarkVisibleRead = async () => {
    const unreadInCurrentTab = notifications.filter(
      (n) => isUnread(n) && getNotificationType(n.type) === notificationTab
    );

    if (unreadInCurrentTab.length === 0) return;

    setNotifications((prev) => prev.map((n) => (getNotificationType(n.type) === notificationTab ? { ...n, isRead: 1 } : n)));

    try {
      await Promise.all(unreadInCurrentTab.map((n) => notificationApi.markRead(n.id)));
      await loadNotifications();
    } catch (error) {
      console.error('Unable to mark notifications as read', error);
    }
  };

  const handleNotificationClick = async (noti: Notification) => {
    setNotifications((prev) => prev.map((item) => (item.id === noti.id ? { ...item, isRead: 1 } : item)));

    try {
      await notificationApi.markRead(noti.id);
    } catch (error) {
      console.error('Unable to mark notification as read', error);
    }

    setNotificationTab(getNotificationType(noti.type));
    if (noti.redirectPath && noti.redirectPath !== '#') {
      window.location.assign(noti.redirectPath);
    }
  };

  // Sinh màu nền avatar ngẫu nhiên dựa trên tên người dùng
  const avatarBg = useMemo(() => {
    if (!user) return 'rgb(122, 82, 56)';
    const name = user.displayName || user.userName || 'U';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    return `rgb(${Math.abs(r) % 150 + 50}, ${Math.abs(g) % 150 + 50}, ${Math.abs(b) % 150 + 50})`;
  }, [user]);

  return (
    <>
      <header className="topnav">
        <div className="topnav__inner">

          {/* LOGO */}
          <a className="logo" href="/" aria-label="Comix home" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            <svg viewBox="0 0 500 122.82" aria-hidden="true">
              <path d="M329.3,35.44l18.56,32.43.62-.58,18.6-31.84h22.95v52.14h-15.38v-36.81l-21.29,36.49c-.2.28-.46.29-.77.33-.97.13-9.36.13-9.78-.12l-21.31-36.7v36.48l-.33.33h-15.27v-52.14h23.39ZM245.16,88.03c9.88.45,22.2.46,32.08-.01,10.66-.51,18.09-3.46,19-15.23.48-6.2.45-16.34,0-22.56-.94-13.17-9.8-15.03-21.18-15.46-9.34-.35-19.9-.24-29.21.24-11.96.61-19.14,2.83-19.9,16.3-.35,6.15-.37,14.69,0,20.83.23,3.9,1.39,8.4,4.26,11.2,3.76,3.67,9.91,4.45,14.96,4.69ZM276.84,73.39c-4.01,2.3-18.3,1.98-23.32,1.71-3.42-.19-8.48-.69-10.26-4.01-1.86-3.48-1.77-15.98.08-19.5,1.77-3.36,7.88-3.71,11.28-3.87,3.96-.18,8.79-.19,12.75-.01,5.15.23,11.13.39,12.52,6.35.69,2.96.63,13.44-.45,16.22-.28.72-.94,1.81-1.5,2.34-.25.23-.78.6-1.09.78ZM211.6,37.38c-3.77-2.16-9.34-2.45-13.65-2.6-8.95-.32-21.58-.66-30.29.48-11.7,1.53-15.78,6.64-16.39,18.27-.26,4.99-.27,11.45-.01,16.44.64,12.46,6.78,17.46,19,18.08,9.01.45,20.43.42,29.45,0,4.92-.23,11.4-1.09,14.93-4.83,3.72-3.93,3.98-10.92,3.4-16h-16.03c.05,3.01-.57,5.87-3.68,6.95-4.1,1.43-15.5,1.21-20.16.95-3.93-.22-8.46-.8-9.94-4.99-1.14-3.26-1.01-13.73-.16-17.15,1.26-5.03,6.89-5.07,11.19-5.27s16.12-.52,19.45,1c2.14.97,2.98,3.13,2.86,5.37h16.03c.16-6.16-.02-13.27-6-16.69ZM425.62,35.44l23.67,25.75-25.43,26.4h20.54l17.16-18.18c.29-.06,2.25,2.02,2.62,2.4,5,5.15,9.64,10.69,14.71,15.78h20.32l-24.81-26.43,22.83-25.71h-19l-15.15,16.87-1.54,1.31-16.04-18.19h-19.88ZM401.45,35.44v52.14h15.71l.33-.33v-51.82h-16.03ZM7.36,91.1l7.2-58.02c0-7.3,5.11-13.24,11.4-13.24l82.71-5.98,8.82-8.04c-1.58-.36-3.22-.56-4.9-.56H25.96C12.42,5.26,1.41,17.74,1.41,33.08v58.02c0,5.62,1.73,11.7,4.27,16.08,0,0,1.68-15,1.68-16.08ZM126.56,26.08l-1.73,11.08,12.32,8.11v-12.18c0-5.95-1.67-11.47-4.5-16l-6.09,8.99ZM123.99,91.1c0,7.3-5.11,13.24-11.4,13.24l-79.3,11.71-13.25,2.02c1.9.54,3.87.85,5.92.85h86.63c13.54,0,24.55-12.48,24.55-27.83v-12.18h0l-13.15,12.18Z"></path>
            </svg>
            <svg viewBox="0 0 500 122.82" aria-hidden="true">
              <path d="M86.45,61.66l29.59,34.03-29.48,5-17.4-20.82-38.8,27.3,39.49-38.51,20.8,23.99,9.9-2.23-24.65-28.77L132.12,3.4l-45.68,58.26ZM62.66,61.16l-23.18-27.23h11.25l17.99,20.22,30.28-32.03-29.58,20.82-13.67-15.82H22.52l29.58,34.03L6.43,119.42l56.23-58.26Z"></path>
            </svg>
          </a>

          {/* KHỐI TÌM KIẾM (SEARCH) */}
          <div className={`search ${isSearchOpen ? 'is-active' : ''}`}>
            <button
              type="button"
              className="icon-btn search-toggle"
              aria-label="Open search"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={18} strokeWidth={2} />
            </button>
            <form ref={searchFormRef} className="search__form" onSubmit={handleSearchSubmit}>
              <Search className="search__icon" size={16} strokeWidth={2} />
              <input
                placeholder="Search any title..."
                value={searchVal}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  setIsSearchOpen(true);
                }}
              />
              <a
                href="/browse"
                className="search__browse"
                title="Browse all titles"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/browse');
                }}
              >
                Browse
              </a>
              <button
                type="button"
                className="search__close"
                aria-label="Clear search"
                onClick={() => {
                  setSearchVal('');
                  setSearchResults([]);
                  setSearchError(null);
                  setIsSearchOpen(false);
                }}
              >
                <X size={16} strokeWidth={2} />
              </button>

              {isSearchOpen && searchVal.trim() && (
                <div className="search-pop" role="listbox">
                  <div className="search-pop__section">
                    <div className="search-pop__label">
                      <span>Results</span>
                    </div>

                    {isSearching ? (
                      <div className="search-pop__empty">
                        <div className="search-pop__empty-title">Searching…</div>
                      </div>
                    ) : searchError ? (
                      <div className="search-pop__empty">
                        <div className="search-pop__empty-title">Unable to load results</div>
                        <div className="search-pop__empty-sub">{searchError}</div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        <ul className="search-pop__list">
                          {searchResults.map((result) => (
                            <li key={result.id} className="search-pop__item search-pop__item--result">
                              <a
                                href={`/comics/${result.url}`}
                                className="search-pop__item-link"
                                onClick={() => {
                                  setSearchVal('');
                                  setSearchResults([]);
                                  setIsSearchOpen(false);
                                }}
                              >
                                <span className="search-pop__thumb">
                                  <div className="poster poster--xs">
                                    <img
                                      alt=""
                                      loading="lazy"
                                      src={result.coverUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=280&q=80'}
                                    />
                                  </div>
                                </span>
                                <span className="search-pop__item-body">
                                  <span className="search-pop__item-title">{result.name}</span>
                                  <span className="search-pop__item-sub">
                                    <span className="search-pop__type">{(result.types || 'OTHER').toUpperCase()}</span>
                                    {result.latestChapter ? (
                                      <>
                                        <span className="search-pop__sep">·</span>
                                        <span>Ch.{result.latestChapter}</span>
                                      </>
                                    ) : null}
                                  </span>
                                </span>
                                {typeof result.rating === 'number' && result.rating > 0 ? (
                                  <span className="search-pop__item-meta mono">★ {result.rating.toFixed(1)}</span>
                                ) : null}
                              </a>
                            </li>
                          ))}
                        </ul>

                        <a
                          className="search-pop__more"
                          href={`/browse?search=${encodeURIComponent(searchVal.trim())}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/browse?search=${encodeURIComponent(searchVal.trim())}`);
                            setIsSearchOpen(false);
                          }}
                        >
                          <span>View all results for <strong>"{searchVal.trim()}"</strong></span>
                          <ChevronRight size={14} strokeWidth={2.25} />
                        </a>
                      </>
                    ) : (
                      <div className="search-pop__empty">
                        <div className="search-pop__empty-title">No matches for "{searchVal.trim()}"</div>
                        <div className="search-pop__empty-sub">Try a different title, author, or genre.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* TOPNAV RIGHT */}
          <nav className="topnav__right">

            {/* SETTINGS */}
            <div className="settings">
              <button
                type="button"
                className="icon-btn"
                aria-label="Settings"
                title="Settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon size={18} strokeWidth={2} />
              </button>
            </div>

            {isLoggedIn ? (
              <>
                {/* MENU BROWSE */}
                <div className="browse">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Menu"
                    title="Browse"
                    onClick={() => navigate('/browse')}
                  >
                    <Menu size={18} strokeWidth={2} />
                  </button>
                </div>

                {/* NOTIFICATIONS BELL */}
                <div className="notifbell" ref={notifRef}>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Notifications"
                    title="Notifications"
                    onClick={() => setNotification(!isNotification)}
                  >
                    <Bell size={18} strokeWidth={2} />

                    {unreadCount > 0 ? <span className="notifbell__dot" aria-hidden="true" /> : null}
                  </button>

                  {isNotification && (
                    <div
                      className="notifpop"
                      role="dialog"
                      aria-label="Notifications"
                    >
                      <div className="notifpop__head">
                        <div className="notifpop__head-text">
                          <h3 className="notifpop__title">Notifications</h3>
                          <span className="notifpop__head-sub">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</span>
                        </div>

                        <button
                          type="button"
                          className="notifpop__mark"
                          disabled={currentTabUnreadCount === 0}
                          title="Mark visible as read"
                          onClick={handleMarkVisibleRead}
                        >
                          <Check size={12} strokeWidth={1.8} aria-hidden="true" />

                          <span>Mark as read</span>
                        </button>
                      </div>

                      <div className="notifpop__tabs" role="tablist">
                        <button
                          role="tab"
                          aria-selected={notificationTab === 'comic'}
                          className={`notifpop__tab ${notificationTab === 'comic' ? 'is-on' : ''}`}
                          onClick={() => setNotificationTab('comic')}
                        >
                          <span>Comic</span>
                          {comicUnreadCount > 0 ? <span className="notifpop__count">{comicUnreadCount}</span> : null}
                        </button>

                        <button
                          role="tab"
                          aria-selected={notificationTab === 'system'}
                          className={`notifpop__tab ${notificationTab === 'system' ? 'is-on' : ''}`}
                          onClick={() => setNotificationTab('system')}
                        >
                          <span>System</span>
                          {systemUnreadCount > 0 ? <span className="notifpop__count">{systemUnreadCount}</span> : null}
                        </button>
                      </div>

                      <ul className="notifpop__list">
                        {isNotificationsLoading ? (
                          <li className="notifpop__empty">
                            <div className="notifpop__empty-title">Loading…</div>
                          </li>
                        ) : notificationsError ? (
                          <li className="notifpop__empty">
                            <div className="notifpop__empty-title">Unable to load notifications</div>
                            <div className="notifpop__empty-sub">{notificationsError}</div>
                          </li>
                        ) : visibleNotifications.length > 0 ? (
                          visibleNotifications.map((noti) => {
                            const unread = isUnread(noti);
                            if(!unread) {
                              return (<></>)
                            }
                            const notificationType = getNotificationType(noti.type);
                            const iconClass = notificationType === 'system' ? 'notifpop__icon--mod' : 'notifpop__icon--reply';

                            return (
                              <li
                                key={noti.id}
                                className={`notifpop__item ${unread ? 'is-unread' : ''}`}
                                role="link"
                                tabIndex={0}
                                onClick={() => handleNotificationClick(noti)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleNotificationClick(noti);
                                  }
                                }}
                              >
                                <span className={`notifpop__icon ${iconClass}`}>
                                  <Bell size={13} strokeWidth={1.8} aria-hidden="true" />
                                </span>

                                <div className="notifpop__body">
                                  <div className="notifpop__text">
                                    <b>{noti.title}</b>
                                  </div>
                                  <div className="notifpop__time mono">
                                    <span>{formatTimeAgo(noti.createdAt)}</span>
                                    {noti.redirectPath && noti.redirectPath.includes('/chapter') ? <span> · Chapter</span> : null}
                                  </div>
                                </div>

                                <a className="notifpop__poster" href={noti.redirectPath || '#'} aria-hidden="true" onClick={(event) => event.preventDefault()}>
                                  <div className="poster poster--xs">
                                    <img alt="" loading="lazy" src={API_UPLOADS + 'comic/default-cover.jpg'} />
                                  </div>
                                </a>
                              </li>
                            );
                          })
                        ) : (
                          <li className="notifpop__empty">
                            <Bell size={22} strokeWidth={1.8} aria-hidden="true" />

                            <div className="notifpop__empty-title">
                              {notificationTab === 'comic' ? 'No comic notifications' : 'No system notifications'}
                            </div>

                            <div className="notifpop__empty-sub">
                              You&apos;re all caught up.
                            </div>
                          </li>
                        )}
                      </ul>

                      <a className="notifpop__all" href="/user?tab=notifs">
                        <span>View all notifications</span>

                        <ChevronRight size={12} strokeWidth={2.25} />
                      </a>
                    </div>
                  )}
                </div>

                {/* USER MENU & DROPDOWN */}
                <div className="usermenu" ref={dropdownRef}>
                  <button
                    type="button"
                    className={`usermenu__btn ${isDropdownOpen ? 'is-active' : ''}`}
                    aria-haspopup="menu"
                    aria-expanded={isDropdownOpen}
                    aria-label="Account menu"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <span className="uavatar" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 12, background: avatarBg }}>
                      {avatarLetter}
                    </span>
                  </button>

                  {isDropdownOpen && (
                    <div className="usermenu__pop" role="menu">
                      <div className="usermenu__head" onClick={() => handleTabClick('edit-profile')}>
                        <span className="uavatar" aria-hidden="true" style={{ width: 40, height: 40, fontSize: 17, background: avatarBg }}>
                          {avatarLetter}
                        </span>
                        <div className="usermenu__id">
                          <div className="usermenu__name">
                            {user?.displayName || 'Nhật PM'}
                          </div>
                          <div className="usermenu__handle mono">
                            @{user?.userName || 'dengu2127'}
                          </div>
                        </div>
                      </div>

                      <div className="usermenu__sep"></div>

                      <ul className="usermenu__list">
                        <li>
                          <a href="/user?tab=edit" className="usermenu__item" role="menuitem" onClick={(e) => { e.preventDefault(); handleTabClick('edit-profile'); }}>
                            <User size={14} strokeWidth={1.8} />
                            <span>My Profile</span>
                          </a>
                        </li>

                        <li>
                          <a href="/user?tab=titles" className="usermenu__item" role="menuitem" onClick={(e) => { e.preventDefault(); handleTabClick('following-titles'); }}>
                            <Bookmark size={14} strokeWidth={1.8} />
                            <span>Following Titles</span>
                          </a>
                        </li>

                        <li>
                          <a href="/user?tab=history" className="usermenu__item" role="menuitem" onClick={(e) => { e.preventDefault(); handleTabClick('read-history'); }}>
                            <History size={14} strokeWidth={1.8} />
                            <span>Read History</span>
                          </a>
                        </li>

                        <li>
                          <a href="/user?tab=notifications" className="usermenu__item" role="menuitem" onClick={(e) => { e.preventDefault(); handleTabClick('notifications'); }}>
                            <Bell size={14} strokeWidth={1.8} />
                            <span>Notifications</span>
                          </a>
                        </li>

                        <li>
                          <a href="/user?tab=comments" className="usermenu__item" role="menuitem" onClick={(e) => { e.preventDefault(); setIsSettingsOpen(true); }}>
                            <MessageSquare size={14} strokeWidth={1.8} />
                            <span>My Comments</span>
                          </a>
                        </li>
                      </ul>

                      <div className="usermenu__sep"></div>

                      <button
                        type="button"
                        className="usermenu__item usermenu__item--signout"
                        role="menuitem"
                        onClick={() => {
                          logout();
                          setIsDropdownOpen(false);
                        }}
                      >
                        <LogOut size={14} strokeWidth={1.8} />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="usermenu">
                <button
                  type="button"
                  className="login-btn"
                  onClick={() => setIsAuthOpen(true)}                >
                  Log in
                </button>
              </div>
            )}

          </nav>
        </div>
      </header>

      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}