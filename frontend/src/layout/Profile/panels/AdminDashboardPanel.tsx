import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi, comicApi, chapterApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { formatTimeAgo } from '../../../helpers/formatDate';
import type { Comic, Chapter } from '../../../types/types';
import '../../../assets/styles/AdminDashboardPanel.css';

const ITEMS_PER_PAGE = 12;

interface Comment {
  id: string;
  source: 'comic' | 'chapter';
  userId: string;
  targetId: string;
  content: string;
  isBanned: number;
  createdAt?: string;
}

interface User {
  id: string;
  username: string;
  displayName?: string;
  role?: string;
  isBanned: number;
  createdAt?: string;
}

interface ComicDetail extends Comic {
  chapters?: any[];
}

interface ChapterDetail extends Chapter {
  images: any[];
}

export default function AdminDashboardPanel() {
  const { user, isLoggedIn } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const canManage = isLoggedIn && role === 'admin';

  const [activeTab, setActiveTab] = useState<'user' | 'comment' | 'comic' | 'chapter'>('user');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeVisibility, setActiveVisibility] = useState<'public' | 'hidden' | 'all'>('all');

  // State lưu ID của dòng đang được mở dropdown trong danh sách
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comics, setComics] = useState<Comic[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [autoAccept, setAutoAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview modal states
  const [comicDetail, setComicDetail] = useState<ComicDetail | null>(null);
  const [chapterDetail, setChapterDetail] = useState<ChapterDetail | null>(null);
  const [chapterImageIndex, setChapterImageIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Đóng dropdown khi click ra ngoài vùng menu ở mỗi dòng
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!(target as HTMLElement).closest('.row-action-fdrop')) {
        setActiveDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    if (!canManage) {
      setError('Please sign in as an admin to access the dashboard.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [dashboardRes, comicsRes, chaptersRes] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getComics(),
        adminApi.getChapters(),
      ]);

      setUsers(dashboardRes?.users || []);
      setComments(dashboardRes?.comments || []);
      setAutoAccept(Boolean(dashboardRes?.autoAccept));
      setComics(comicsRes || []);
      setChapters(chaptersRes || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [canManage, user?.role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchInput, activeVisibility]);

  const toggleUserBan = async (userId: string, isBanned: boolean) => {
    try {
      await adminApi.toggleUserBan(userId, !isBanned);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update user ban status');
    }
  };

  const toggleCommentBan = async (targetType: 'comic' | 'chapter', commentId: string, isBanned: boolean) => {
    try {
      await adminApi.toggleCommentBan(targetType, commentId, !isBanned);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update comment ban status');
    }
  };

  const updateComicVisibility = async (comicId: string, visibility: 'public' | 'hidden') => {
    try {
      await adminApi.updateComicVisibility(comicId, visibility);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update comic visibility');
    }
  };

  const updateChapterVisibility = async (chapterId: string, visibility: 'public' | 'hidden') => {
    try {
      await adminApi.updateChapterVisibility(chapterId, visibility);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update chapter visibility');
    }
  };

  const toggleAutoAccept = async () => {
    try {
      const response = await adminApi.setAutoAccept(!autoAccept);
      setAutoAccept(Boolean(response.enabled));
    } catch (err: any) {
      setError(err?.message || 'Unable to update auto-accept');
    }
  };

  const loadComicDetail = async (comic: Comic) => {
    setPreviewLoading(true);
    try {
      const detail = await comicApi.getByUrl(comic.url);
      setComicDetail(detail);
    } catch (err: any) {
      console.error('Error loading comic detail:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadChapterDetail = async (chapter: Chapter) => {
    setPreviewLoading(true);
    setChapterImageIndex(0);
    try {
      const detail = await chapterApi.getDetails(chapter.id);
      setChapterDetail({ ...detail, images: detail.images || [] });
    } catch (err: any) {
      console.error('Error loading chapter detail:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Get all items without filters for count badges
  const allItemsByTab = useMemo(() => {
    if (activeTab === 'user') return users;
    if (activeTab === 'comment') return comments;
    if (activeTab === 'comic') return comics;
    if (activeTab === 'chapter') return chapters;
    return [];
  }, [users, comments, comics, chapters, activeTab]);

  const counts = useMemo(() => {
    if (activeTab === 'user') {
      const banned = users.filter((u) => u.isBanned).length;
      const active = users.filter((u) => !u.isBanned).length;
      return { banned, active };
    }
    if (activeTab === 'comment') {
      const banned = comments.filter((c) => c.isBanned).length;
      const active = comments.filter((c) => !c.isBanned).length;
      return { banned, active };
    }
    if (activeTab === 'comic') {
      const hidden = comics.filter((c) => c.visibility === 'hidden').length;
      const visible = comics.filter((c) => c.visibility === 'public').length;
      return { hidden, visible };
    }
    if (activeTab === 'chapter') {
      const hidden = chapters.filter((c) => c.visibility === 'hidden').length;
      const visible = chapters.filter((c) => c.visibility === 'public').length;
      return { hidden, visible };
    }
    return { banned: 0, active: 0, hidden: 0, visible: 0 };
  }, [activeTab, users, comments, comics, chapters]);

  // Filter items based on search and visibility/ban status
  const filteredItems = useMemo(() => {
    let items: any[] = [];

    if (activeTab === 'user') {
      items = users;
    } else if (activeTab === 'comment') {
      items = comments;
    } else if (activeTab === 'comic') {
      items = comics;
    } else if (activeTab === 'chapter') {
      items = chapters;
    }

    // Filter by visibility/ban status
    if (activeTab === 'user' || activeTab === 'comment') {
      if (activeVisibility === 'hidden') {
        items = items.filter((i) => i.isBanned);
      } else if (activeVisibility === 'public') {
        items = items.filter((i) => !i.isBanned);
      }
    } else if (activeTab === 'comic' || activeTab === 'chapter') {
      if (activeVisibility !== 'all') {
        items = items.filter((i) => i.visibility === activeVisibility);
      }
    }

    // Filter by search
    if (searchInput.trim()) {
      const query = searchInput.toLowerCase();
      items = items.filter((item) => {
        if (activeTab === 'user') {
          return (
            (item.username || '').toLowerCase().includes(query) ||
            (item.displayName || '').toLowerCase().includes(query)
          );
        } else if (activeTab === 'comment') {
          return (item.content || '').toLowerCase().includes(query);
        } else if (activeTab === 'comic') {
          return (item.name || '').toLowerCase().includes(query);
        } else if (activeTab === 'chapter') {
          return (
            (item.title || '').toLowerCase().includes(query) ||
            String(item.chapterNumber).includes(query)
          );
        }
        return false;
      });
    }

    return items;
  }, [activeTab, searchInput, activeVisibility, users, comments, comics, chapters]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="uview">
      <div className="uview__head uview__head--row">
        <div>
          <h2 className="uview__title">Admin Dashboard</h2>
          <p className="uview__sub">Manage users, comments, comics, and chapters visibility.</p>
        </div>
      </div>

      {/* Auto accept toggle */}
      <div className="usettings__section">
        <h3 className="usettings__section-title">Auto accept</h3>
        <p className="usettings__section-sub">Automatically approve newly submitted content without manual moderation.</p>
        <label className={`usettings__row ${autoAccept ? 'is-on' : ''}`}>
          <span className="usettings__row-body">
            <span className="usettings__row-title">Auto accept content</span>
            <span className="usettings__row-hint">Enable or disable the admin moderation shortcut.</span>
          </span>
          <span className={`usettings__switch ${autoAccept ? 'is-on' : ''}`} aria-hidden="true">
            <input type="checkbox" checked={autoAccept} onChange={toggleAutoAccept} />
            <span className="usettings__switch-track"></span>
            <span className="usettings__switch-thumb"></span>
          </span>
        </label>
      </div>

      {/* Tabs */}
      <div className="usettings__section">
        <h3 className="usettings__section-title">Management</h3>

        <div className="nfilters">
          <div className="useg">
            <button
              type="button"
              className={`useg__btn ${activeTab === 'user' ? 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('user');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              Users
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'comment' ? 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('comment');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              Comments
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'comic' ? 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('comic');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              Comics
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'chapter' ? 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('chapter');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              Chapters
            </button>
          </div>

          <div className="useg">
            {(activeTab === 'user' || activeTab === 'comment') ? (
              <>
                <button
                  type="button"
                  className={`useg__btn ${activeVisibility === 'public' ? 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('public')}
                >
                  Active
                  <span className="useg__count mono">{counts.active}</span>
                </button>
                <button
                  type="button"
                  className={`useg__btn ${activeVisibility === 'hidden' ? 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('hidden')}
                >
                  Banned
                  <span className="useg__count mono">{counts.banned}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`useg__btn ${activeVisibility === 'public' ? 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('public')}
                >
                  Public
                  <span className="useg__count mono">{counts.visible}</span>
                </button>
                <button
                  type="button"
                  className={`useg__btn ${activeVisibility === 'hidden' ? 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('hidden')}
                >
                  Hidden
                  <span className="useg__count mono">{counts.hidden}</span>
                </button>
              </>
            )}
            <button
              type="button"
              className={`useg__btn ${activeVisibility === 'all' ? 'is-on' : ''}`}
              onClick={() => setActiveVisibility('all')}
            >
              All
              <span className="useg__count mono">{allItemsByTab.length}</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="filter-top">
          <div className="filter-search bg-sf-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
            </svg>
            <input
              placeholder="Search..."
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {/* Loading or Error */}
        {loading ? (
          <div className="uempty">Loading dashboard…</div>
        ) : error && !canManage ? (
          <div className="uempty">{error}</div>
        ) : error ? (
          <div className="uempty">{error}</div>
        ) : paginatedItems.length > 0 ? (
          <>
            <div className="hgrid">
              {paginatedItems.map((item) => {
                if (activeTab === 'user') {
                  const userItem = item as User;
                  const isBanned = Boolean(userItem.isBanned);
                  const isDropdownOpen = activeDropdownId === userItem.id;

                  return (
                    <div key={userItem.id} className="ulrow">
                      <div className="ulrow__body">
                        <div className="ulrow__title">{userItem.displayName || userItem.username}</div>
                        <div className="ulrow__meta">
                          <span className="ulrow__status ulrow__status--releasing">{userItem.role || 'User'}</span>
                          <span className="ulrow__dot" />
                          <span className="card__time">@{userItem.username}</span>
                          {userItem.createdAt ? (
                            <>
                              <span className="ulrow__dot" />
                              <span className="card__time">joined {formatTimeAgo(userItem.createdAt)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="ulrow__actions">
                        {/* Custom status dropdown cho Users */}
                        <div 
                          className={`fdrop row-action-fdrop ${isDropdownOpen ? 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className="fdrop__btn ubtn--sm" 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : userItem.id)}
                          >
                            <span className="fdrop__value">
                              {isBanned ? 'Banned' : 'Active'}
                            </span>
                            <svg className="fdrop__caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className="fdrop__pop fdrop__pop--menu" 
                              role="listbox" 
                              style={{ 
                                position: 'absolute', 
                                right: 0, 
                                top: '100%', 
                                marginTop: '4px', 
                                zIndex: 10, 
                                minWidth: '84px' 
                              }}
                            >
                              {[
                                { key: 'active', label: 'Active', value: false },
                                { key: 'banned', label: 'Banned', value: true }
                              ].map((opt) => {
                                const isSelected = isBanned === opt.value;
                                return (
                                  <li
                                    key={opt.key}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                                    onClick={() => {
                                      if (!isSelected) {
                                        void toggleUserBan(userItem.id, isBanned);
                                      }
                                      setActiveDropdownId(null);
                                    }}
                                  >
                                    {opt.label}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'comment') {
                  const commentItem = item as Comment;
                  const isBanned = Boolean(commentItem.isBanned);
                  const isDropdownOpen = activeDropdownId === commentItem.id;

                  return (
                    <div key={commentItem.id} className="ulrow">
                      <div className="ulrow__body">
                        <div className="ulrow__title">{commentItem.content}</div>
                        <div className="ulrow__meta">
                          <span className="ulrow__status ulrow__status--releasing">
                            {commentItem.source === 'comic' ? 'Comic' : 'Chapter'}
                          </span>
                          <span className="ulrow__dot" />
                          <span className="card__time">{formatTimeAgo(commentItem.createdAt)}</span>
                        </div>
                      </div>
                      <div className="ulrow__actions">
                        {/* Custom status dropdown cho Comments */}
                        <div 
                          className={`fdrop row-action-fdrop ${isDropdownOpen ? 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className="fdrop__btn ubtn--sm" 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : commentItem.id)}
                          >
                            <span className="fdrop__value">
                              {isBanned ? 'Banned' : 'Visible'}
                            </span>
                            <svg className="fdrop__caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className="fdrop__pop fdrop__pop--menu" 
                              role="listbox" 
                              style={{ 
                                position: 'absolute', 
                                right: 0, 
                                top: '100%', 
                                marginTop: '4px', 
                                zIndex: 10, 
                                minWidth: '84px' 
                              }}
                            >
                              {[
                                { key: 'visible', label: 'Visible', value: false },
                                { key: 'banned', label: 'Banned', value: true }
                              ].map((opt) => {
                                const isSelected = isBanned === opt.value;
                                return (
                                  <li
                                    key={opt.key}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                                    onClick={() => {
                                      if (!isSelected) {
                                        void toggleCommentBan(commentItem.source, commentItem.id, isBanned);
                                      }
                                      setActiveDropdownId(null);
                                    }}
                                  >
                                    {opt.label}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'comic') {
                  const comicItem = item as Comic;
                  const isDropdownOpen = activeDropdownId === comicItem.id;

                  return (
                    <div key={comicItem.id} className="ulrow">
                      <div className="ulrow__body">
                        <div className="ulrow__title">{comicItem.name}</div>
                        <div className="ulrow__meta">
                          <span className="ulrow__status ulrow__status--releasing" style={{ textTransform: 'capitalize' }}>
                            {comicItem.visibility}
                          </span>
                          <span className="ulrow__dot" />
                          <span className="card__time">{formatTimeAgo(comicItem.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="ulrow__actions">
                        <button
                          type="button"
                          className="ubtn ubtn--ghost ubtn--sm"
                          onClick={() => void loadComicDetail(comicItem)}
                        >
                          Preview
                        </button>
                        
                        {/* Custom status dropdown cho Comics */}
                        <div 
                          className={`fdrop row-action-fdrop ${isDropdownOpen ? 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className="fdrop__btn ubtn--sm" 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : comicItem.id)}
                          >
                            <span className="fdrop__value" style={{ textTransform: 'capitalize' }}>
                              {comicItem.visibility}
                            </span>
                            <svg className="fdrop__caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className="fdrop__pop fdrop__pop--menu" 
                              role="listbox" 
                              style={{ 
                                position: 'absolute', 
                                right: 0, 
                                top: '100%', 
                                marginTop: '4px', 
                                zIndex: 10, 
                                minWidth: '84px' 
                              }}
                            >
                              {['public', 'hidden'].map((statusOption) => {
                                const isSelected = comicItem.visibility === statusOption;
                                return (
                                  <li
                                    key={statusOption}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                                    onClick={() => {
                                      if (!isSelected) {
                                        void updateComicVisibility(comicItem.id, statusOption as 'public' | 'hidden');
                                      }
                                      setActiveDropdownId(null);
                                    }}
                                    style={{ textTransform: 'capitalize' }}
                                  >
                                    {statusOption}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'chapter') {
                  const chapterItem = item as Chapter;
                  const isDropdownOpen = activeDropdownId === chapterItem.id;

                  return (
                    <div key={chapterItem.id} className="ulrow">
                      <div className="ulrow__body">
                        <div className="ulrow__title">
                          {chapterItem.title} - Chapter {chapterItem.chapterNumber}
                        </div>
                        <div className="ulrow__meta">
                          <span className="ulrow__status ulrow__status--releasing" style={{ textTransform: 'capitalize' }}>
                            {chapterItem.visibility}
                          </span>
                          <span className="ulrow__dot" />
                          <span className="card__time">{formatTimeAgo(chapterItem.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="ulrow__actions">
                        <button
                          type="button"
                          className="ubtn ubtn--ghost ubtn--sm"
                          onClick={() => void loadChapterDetail(chapterItem)}
                        >
                          Preview
                        </button>

                        {/* Custom status dropdown cho Chapters */}
                        <div 
                          className={`fdrop row-action-fdrop ${isDropdownOpen ? 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className="fdrop__btn ubtn--sm" 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : chapterItem.id)}
                          >
                            <span className="fdrop__value" style={{ textTransform: 'capitalize' }}>
                              {chapterItem.visibility}
                            </span>
                            <svg className="fdrop__caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className="fdrop__pop fdrop__pop--menu" 
                              role="listbox" 
                              style={{ 
                                position: 'absolute', 
                                right: 0, 
                                top: '100%', 
                                marginTop: '4px', 
                                zIndex: 10, 
                                minWidth: '110px' 
                              }}
                            >
                              {['public', 'hidden'].map((statusOption) => {
                                const isSelected = chapterItem.visibility === statusOption;
                                return (
                                  <li
                                    key={statusOption}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                                    onClick={() => {
                                      if (!isSelected) {
                                        void updateChapterVisibility(chapterItem.id, statusOption as 'public' | 'hidden');
                                      }
                                      setActiveDropdownId(null);
                                    }}
                                    style={{ textTransform: 'capitalize' }}
                                  >
                                    {statusOption}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="upagination">
                <button
                  type="button"
                  className="upagination__btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="upagination__info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="upagination__btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="uempty">
            <div className="uempty__icon"></div>
            <div className="uempty__title">Nothing here.</div>
            <div className="uempty__sub">No items found.</div>
          </div>
        )}
      </div>

      {/* Comic Preview Modal */}
      {comicDetail && (
        <div className="modal-overlay" onClick={() => setComicDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {previewLoading ? (
              <div className="modal-loading">Loading...</div>
            ) : (
              <>
                <div className="modal-header">
                  <h3>{comicDetail.name}</h3>
                  <button type="button" onClick={() => setComicDetail(null)}>×</button>
                </div>
                <div className="modal-body">
                  <img src={comicDetail.coverUrl} alt={comicDetail.name} className="modal-image" />
                  <div className="modal-info">
                    <p><strong>Types:</strong> {comicDetail.types}</p>
                    <p><strong>Demographic:</strong> {comicDetail.demographic}</p>
                    <p><strong>Description:</strong> {comicDetail.description}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chapter Preview Modal */}
      {chapterDetail && (
        <div className="modal-overlay" onClick={() => setChapterDetail(null)}>
          <div className="modal-content modal-carousel" onClick={(e) => e.stopPropagation()}>
            {previewLoading ? (
              <div className="modal-loading">Loading...</div>
            ) : chapterDetail.images && chapterDetail.images.length > 0 ? (
              <>
                <div className="modal-header">
                  <h3>{chapterDetail.title}</h3>
                  <button type="button" onClick={() => setChapterDetail(null)}>×</button>
                </div>
                <div className="modal-carousel-body">
                  <img src={chapterDetail.images[chapterImageIndex]?.url} alt="Chapter page" className="modal-image-full" />
                  <div className="modal-carousel-info">
                    {chapterImageIndex + 1} / {chapterDetail.images.length} pages
                  </div>
                  <div className="modal-carousel-controls">
                    <button
                      type="button"
                      onClick={() => setChapterImageIndex((i) => Math.max(0, i - 1))}
                      disabled={chapterImageIndex === 0}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChapterImageIndex((i) => Math.min(chapterDetail.images.length - 1, i + 1))}
                      disabled={chapterImageIndex === chapterDetail.images.length - 1}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="modal-loading">No images available</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}