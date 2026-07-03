import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Settings from './Settings';
import AuthModal from './AuthModal';
import '../assets/styles/Header.css';

// Import các icon bổ sung nếu cần dùng trong dropdown
import {
  User, Globe, Bookmark, History, Bell, Settings as SettingsIcon, LogOut
} from 'lucide-react';

export default function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [isNotification, setNotification] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarLetter = useMemo(() => {
    return user?.displayName?.[0] || user?.userName?.[0] || 'U';
  }, [user]);

  const handleTabClick = (tabId: string) => {
    setIsDropdownOpen(false);
    navigate(`/profile?tab=${tabId}`);
  };

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
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/browse?search=${encodeURIComponent(searchVal.trim())}`);
      setIsSearchOpen(false);
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
            <form className="search__form" onSubmit={handleSearchSubmit}>
              <svg className="search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                placeholder="Search any title..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
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
                  setIsSearchOpen(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6l-12 12"></path>
                </svg>
              </button>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
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
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>

                    <span className="notifbell__dot" aria-hidden="true" />
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
                        </div>

                        <button
                          type="button"
                          className="notifpop__mark"
                          disabled
                          title="Mark visible as read"
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
                            <path d="M4 12l5 5L20 6" />
                          </svg>

                          <span>Mark as read</span>
                        </button>
                      </div>

                      <div className="notifpop__tabs" role="tablist">
                        <button
                          role="tab"
                          aria-selected="true"
                          className="notifpop__tab is-on"
                        >
                          <span>Comics</span>
                        </button>

                        <button
                          role="tab"
                          aria-selected="false"
                          className="notifpop__tab"
                        >
                          <span>Community</span>
                        </button>
                      </div>

                      <ul className="notifpop__list">
                        <li className="notifpop__empty">
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3z" />
                            <path d="M10 20a2 2 0 0 0 4 0" />
                          </svg>

                          <div className="notifpop__empty-title">
                            No comics notifications
                          </div>

                          <div className="notifpop__empty-sub">
                            You're all caught up.
                          </div>
                        </li>
                      </ul>

                      <a className="notifpop__all" href="/user?tab=notifs">
                        <span>View all notifications</span>

                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
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
                    <div className="profile-dropdown">
                      <div className="dropdown-user-info" onClick={() => handleTabClick('edit-profile')}>
                        <div className="dropdown-user-avatar" style={{ background: avatarBg }}>
                          {avatarLetter}
                        </div>
                        <div className="dropdown-user-text">
                          <div className="dropdown-display-name">
                            {user?.displayName || 'Nhật PM'}
                          </div>
                          <div className="dropdown-username">
                            @{user?.userName || 'dengu2127'}
                          </div>
                        </div>
                      </div>

                      <div className="dropdown-menu-list">
                        <button className="dropdown-item" onClick={() => handleTabClick('edit-profile')}>
                          <User className="dropdown-icon" strokeWidth={2} size={18} />
                          My Profile
                        </button>

                        <button className="dropdown-item" onClick={() => handleTabClick('public-profile')}>
                          <Globe className="dropdown-icon" strokeWidth={2} size={18} />
                          Public profile
                        </button>

                        <button className="dropdown-item" onClick={() => handleTabClick('following-titles')}>
                          <Bookmark className="dropdown-icon" strokeWidth={2} size={18} />
                          Following Titles
                        </button>

                        <button className="dropdown-item" onClick={() => handleTabClick('read-history')}>
                          <History className="dropdown-icon" strokeWidth={2} size={18} />
                          Read History
                        </button>

                        <button className="dropdown-item" onClick={() => handleTabClick('notifications')}>
                          <Bell className="dropdown-icon" strokeWidth={2} size={18} />
                          Notifications
                        </button>

                        <button className="dropdown-item" onClick={() => setIsSettingsOpen(true)}>
                          <SettingsIcon className="dropdown-icon" strokeWidth={2} size={18} />
                          Settings
                        </button>

                        <div className="dropdown-divider"></div>

                        <button
                          className="dropdown-item signout-btn"
                          onClick={() => {
                            logout();
                            setIsDropdownOpen(false);
                          }}
                        >
                          <LogOut className="dropdown-icon" strokeWidth={2} size={18} />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="usermenu">
                <button
                  type="button"
                  className="usermenu__btn login-btn"
                  onClick={() => setIsAuthOpen(true)}
                  style={{ fontSize: '13px', padding: '0 12px', height: '28px', borderRadius: '4px' }}
                >
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