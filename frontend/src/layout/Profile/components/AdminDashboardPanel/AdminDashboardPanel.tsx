import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { adminApi, comicApi, chapterApi, API_UPLOADS } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import { parsePageNumber, formatDisplayValue } from '../../../../helpers/utils';
import { DEMOGRAPHIC_OPTIONS, STATUS_OPTIONS } from '../ComicSuggestionPanel/ComicSuggestionPanel';
import type { Comic, Chapter, Comment, AdminUser, ComicDetail, ChapterDetail } from '../../../../types/types';
import style from './AdminDashboardPanel.module.css';

const ITEMS_PER_PAGE = 12;

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

  const [users, setUsers] = useState<AdminUser[]>([]);
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
      const targetClass = style['row-action-fdrop'] || 'row-action-fdrop';
      if (!(target as HTMLElement).closest(`.${targetClass}`)) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update user ban status');
    }
  };

  const toggleCommentBan = async (targetType: 'comic' | 'chapter', commentId: string, isBanned: boolean) => {
    try {
      await adminApi.toggleCommentBan(targetType, commentId, !isBanned);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update comment ban status');
    }
  };

  const updateComicVisibility = async (comicId: string, visibility: 'public' | 'hidden') => {
    try {
      await adminApi.updateComicVisibility(comicId, visibility);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update comic visibility');
    }
  };

  const updateChapterVisibility = async (chapterId: string, visibility: 'public' | 'hidden') => {
    try {
      await adminApi.updateChapterVisibility(chapterId, visibility);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update chapter visibility');
    }
  };

  const toggleAutoAccept = async () => {
    try {
      const response = await adminApi.setAutoAccept(!autoAccept);
      setAutoAccept(Boolean(response.enabled));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update auto-accept');
    }
  };

  const loadComicDetail = async (comic: Comic) => {
    setPreviewLoading(true);
    try {
      const detail = await comicApi.getByUrl(comic.url);
      setComicDetail(detail);
    } catch (err: unknown) {
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
      // Sort images by page number if they exist
      const images = detail.images ? [...detail.images].sort((a, b) => {
        const nA = a.pageNumber || parsePageNumber(a.urlPath || '');
        const nB = b.pageNumber || parsePageNumber(b.urlPath || '');
        return nA - nB;
      }) : [];
      setChapterDetail({ ...detail, images });
    } catch (err: unknown) {
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
    let items: (AdminUser | Comment | Comic | Chapter)[] = [];

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
    if (activeTab === 'user') {
      const userItems = items as AdminUser[];
      if (activeVisibility === 'hidden') {
        items = userItems.filter((i) => i.isBanned);
      } else if (activeVisibility === 'public') {
        items = userItems.filter((i) => !i.isBanned);
      }
    } else if (activeTab === 'comment') {
      const commentItems = items as Comment[];
      if (activeVisibility === 'hidden') {
        items = commentItems.filter((i) => i.isBanned);
      } else if (activeVisibility === 'public') {
        items = commentItems.filter((i) => !i.isBanned);
      }
    } else if (activeTab === 'comic') {
      const comicItems = items as Comic[];
      if (activeVisibility !== 'all') {
        items = comicItems.filter((i) => i.visibility === activeVisibility);
      }
    } else if (activeTab === 'chapter') {
      const chapterItems = items as Chapter[];
      if (activeVisibility !== 'all') {
        items = chapterItems.filter((i) => i.visibility === activeVisibility);
      }
    }

    // Filter by search
    if (searchInput.trim()) {
      const query = searchInput.toLowerCase();
      if (activeTab === 'user') {
        items = (items as AdminUser[]).filter((item) =>
          (item.username || '').toLowerCase().includes(query) ||
          (item.displayName || '').toLowerCase().includes(query)
        );
      } else if (activeTab === 'comment') {
        items = (items as Comment[]).filter((item) => (item.content || '').toLowerCase().includes(query));
      } else if (activeTab === 'comic') {
        items = (items as Comic[]).filter((item) => (item.name || '').toLowerCase().includes(query));
      } else if (activeTab === 'chapter') {
        items = (items as Chapter[]).filter((item) =>
          (item.title || '').toLowerCase().includes(query) ||
          String(item.chapterNumber).includes(query)
        );
      }
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
    <div className={style['uview']}>
      <div className={`${style['uview__head']} ${style['uview__head--row']}`}>
        <div>
          <h2 className={style['uview__title']}>Admin Dashboard</h2>
          <p className={style['uview__sub']}>Manage users, comments, comics, and chapters visibility.</p>
        </div>
      </div>

      {/* Auto accept toggle */}
      <div className={style['usettings__section']}>
        <h3 className={style['usettings__section-title']}>Auto accept</h3>
        <p className={style['usettings__section-sub']}>Automatically approve newly submitted content without manual moderation.</p>
        <label className={`${style['usettings__row']} ${autoAccept ? style['is-on'] || 'is-on' : ''}`}>
          <span className={style['usettings__row-body']}>
            <span className={style['usettings__row-title']}>Auto accept content</span>
            <span className={style['usettings__row-hint']}>Enable or disable the admin moderation shortcut.</span>
          </span>
          <span className={`${style['usettings__switch']} ${autoAccept ? style['is-on'] || 'is-on' : ''}`} aria-hidden="true">
            <input type="checkbox" checked={autoAccept} onChange={toggleAutoAccept} />
            <span className={style['usettings__switch-track']}></span>
            <span className={style['usettings__switch-thumb']}></span>
          </span>
        </label>
      </div>

      {/* Tabs */}
      <div className={style['usettings__section']}>
        <h3 className={style['usettings__section-title']}>Management</h3>

        <div className={style['nfilters']}>
          <div className={style['useg']}>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'user' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('user');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{users.length}</span>
              Users
            </button>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'comment' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('comment');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{comments.length}</span>
              Comments
            </button>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'comic' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('comic');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{comics.length}</span>
              Comics
            </button>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'chapter' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => {
                setActiveTab('chapter');
                setActiveVisibility('all');
                setSearchInput('');
              }}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{chapters.length}</span>
              Chapters
            </button>
          </div>

          <div className={style['useg']}>
            {(activeTab === 'user' || activeTab === 'comment') ? (
              <>
                <button
                  type="button"
                  className={`${style['useg__btn']} ${activeVisibility === 'public' ? style['is-on'] || 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('public')}
                >
                  <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{counts.active}</span>
                  Active
                </button>
                <button
                  type="button"
                  className={`${style['useg__btn']} ${activeVisibility === 'hidden' ? style['is-on'] || 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('hidden')}
                >
                  <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{counts.banned}</span>
                  Banned
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`${style['useg__btn']} ${activeVisibility === 'public' ? style['is-on'] || 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('public')}
                >
                  <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{counts.visible}</span>
                  Public
                </button>
                <button
                  type="button"
                  className={`${style['useg__btn']} ${activeVisibility === 'hidden' ? style['is-on'] || 'is-on' : ''}`}
                  onClick={() => setActiveVisibility('hidden')}
                >
                  <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{counts.hidden}</span>
                  Hidden
                </button>
              </>
            )}
            <button
              type="button"
              className={`${style['useg__btn']} ${activeVisibility === 'all' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => setActiveVisibility('all')}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{allItemsByTab.length}</span>
              All
            </button>
          </div>
        </div>

        {/* Search */}
        <div className={style['filter-top']}>
          <div className={`${style['filter-search']} ${style['bg-sf-2'] || 'bg-sf-2'}`}>
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
          <div className={style['uempty']}>Loading dashboard…</div>
        ) : error && !canManage ? (
          <div className={style['uempty']}>{error}</div>
        ) : error ? (
          <div className={style['uempty']}>{error}</div>
        ) : paginatedItems.length > 0 ? (
          <>
            <div className={style['hgrid']}>
              {paginatedItems.map((item) => {
                if (activeTab === 'user') {
                  const userItem = item as AdminUser;
                  const isBanned = Boolean(userItem.isBanned);
                  const isDropdownOpen = activeDropdownId === userItem.id;

                  return (
                    <div key={userItem.id} className={style['ulrow']}>
                      <div className={style['ulrow__body']}>
                        <div className={style['ulrow__title']}>{userItem.displayName || userItem.username}</div>
                        <div className={style['ulrow__meta']}>
                          <span className={`${style['ulrow__status']} ${style['ulrow__status--releasing']}`}>{userItem.role || 'User'}</span>
                          <span className={style['ulrow__dot']} />
                          <span className={style['card__time']}>@{userItem.username}</span>
                          {userItem.createdAt ? (
                            <>
                              <span className={style['ulrow__dot']} />
                              <span className={style['card__time']}>joined {formatTimeAgo(userItem.createdAt)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className={style['ulrow__actions']}>
                        {/* Custom status dropdown cho Users */}
                        <div 
                          className={`${style['fdrop']} ${style['row-action-fdrop']} ${isDropdownOpen ? style['is-open'] || 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className={`${style['fdrop__btn']} ${style['ubtn--sm']}`} 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : userItem.id)}
                          >
                            <span className={style['fdrop__value']}>
                              {isBanned ? 'Banned' : 'Active'}
                            </span>
                            <svg className={style['fdrop__caret']} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className={`${style['fdrop__pop']} ${style['fdrop__pop--menu']}`} 
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
                                    className={`${style['fdrop__item']} ${isSelected ? style['is-active'] || 'is-active' : ''}`}
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
                    <div key={commentItem.id} className={style['ulrow']}>
                      <div className={style['ulrow__body']}>
                        <div className={style['ulrow__title']}>{commentItem.content}</div>
                        <div className={style['ulrow__meta']}>
                          <span className={`${style['ulrow__status']} ${style['ulrow__status--releasing']}`}>
                            {commentItem.source === 'comic' ? 'Comic' : 'Chapter'}
                          </span>
                          <span className={style['ulrow__dot']} />
                          <span className={style['card__time']}>{formatTimeAgo(commentItem.createdAt)}</span>
                        </div>
                      </div>
                      <div className={style['ulrow__actions']}>
                        {/* Custom status dropdown cho Comments */}
                        <div 
                          className={`${style['fdrop']} ${style['row-action-fdrop']} ${isDropdownOpen ? style['is-open'] || 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className={`${style['fdrop__btn']} ${style['ubtn--sm']}`} 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : commentItem.id)}
                          >
                            <span className={style['fdrop__value']}>
                              {isBanned ? 'Banned' : 'Visible'}
                            </span>
                            <svg className={style['fdrop__caret']} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className={`${style['fdrop__pop']} ${style['fdrop__pop--menu']}`} 
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
                                    className={`${style['fdrop__item']} ${isSelected ? style['is-active'] || 'is-active' : ''}`}
                                    onClick={() => {
                                      if (!isSelected && commentItem.source) {
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
                    <div key={comicItem.id} className={style['ulrow']}>
                      <div className={style['ulrow__body']}>
                        <div className={style['ulrow__title']}>{comicItem.name}</div>
                        <div className={style['ulrow__meta']}>
                          <span className={`${style['ulrow__status']} ${style['ulrow__status--releasing']}`} style={{ textTransform: 'capitalize' }}>
                            {comicItem.visibility}
                          </span>
                          <span className={style['ulrow__dot']} />
                          <span className={style['card__time']}>{formatTimeAgo(comicItem.updatedAt)}</span>
                        </div>
                      </div>
                      <div className={style['ulrow__actions']}>
                        <button
                          type="button"
                          className={`${style['ubtn']} ${style['ubtn--ghost']} ${style['ubtn--sm']}`}
                          onClick={() => void loadComicDetail(comicItem)}
                        >
                          Preview
                        </button>
                        
                        {/* Custom status dropdown cho Comics */}
                        <div 
                          className={`${style['fdrop']} ${style['row-action-fdrop']} ${isDropdownOpen ? style['is-open'] || 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className={`${style['fdrop__btn']} ${style['ubtn--sm']}`} 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : comicItem.id)}
                          >
                            <span className={style['fdrop__value']} style={{ textTransform: 'capitalize' }}>
                              {comicItem.visibility}
                            </span>
                            <svg className={style['fdrop__caret']} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className={`${style['fdrop__pop']} ${style['fdrop__pop--menu']}`} 
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
                                    className={`${style['fdrop__item']} ${isSelected ? style['is-active'] || 'is-active' : ''}`}
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
                    <div key={chapterItem.id} className={style['ulrow']}>
                      <div className={style['ulrow__body']}>
                        <div className={style['ulrow__title']}>
                          {chapterItem.title} - Chapter {chapterItem.chapterNumber}
                        </div>
                        <div className={style['ulrow__meta']}>
                          <span className={`${style['ulrow__status']} ${style['ulrow__status--releasing']}`} style={{ textTransform: 'capitalize' }}>
                            {chapterItem.visibility}
                          </span>
                          <span className={style['ulrow__dot']} />
                          <span className={style['card__time']}>{formatTimeAgo(chapterItem.updatedAt)}</span>
                        </div>
                      </div>
                      <div className={style['ulrow__actions']}>
                        <button
                          type="button"
                          className={`${style['ubtn']} ${style['ubtn--ghost']} ${style['ubtn--sm']}`}
                          onClick={() => void loadChapterDetail(chapterItem)}
                        >
                          Preview
                        </button>

                        {/* Custom status dropdown cho Chapters */}
                        <div 
                          className={`${style['fdrop']} ${style['row-action-fdrop']} ${isDropdownOpen ? style['is-open'] || 'is-open' : ''}`} 
                          style={{ position: 'relative' }}
                        >
                          <button 
                            type="button" 
                            className={`${style['fdrop__btn']} ${style['ubtn--sm']}`} 
                            style={{ 
                              height: '32px', 
                              minWidth: '84px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}
                            onClick={() => setActiveDropdownId(isDropdownOpen ? null : chapterItem.id)}
                          >
                            <span className={style['fdrop__value']} style={{ textTransform: 'capitalize' }}>
                              {chapterItem.visibility}
                            </span>
                            <svg className={style['fdrop__caret']} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          
                          {isDropdownOpen && (
                            <ul 
                              className={`${style['fdrop__pop']} ${style['fdrop__pop--menu']}`} 
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
                                    className={`${style['fdrop__item']} ${isSelected ? style['is-active'] || 'is-active' : ''}`}
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
              <div className={style['upagination']}>
                <button
                  type="button"
                  className={style['upagination__btn']}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={style['upagination__info']}>
                  <span className={style['upagination__current']}>{currentPage}</span>
                  <span className={style['upagination__separator']}>/</span>
                  <span className={style['upagination__total']}>{totalPages}</span>
                </span>
                <button
                  type="button"
                  className={style['upagination__btn']}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={style['uempty']}>
            <div className={style['uempty__icon']}></div>
            <div className={style['uempty__title']}>Nothing here.</div>
            <div className={style['uempty__sub']}>No items found.</div>
          </div>
        )}
      </div>

      {/* Comic Preview Modal */}
      {comicDetail && (
        <div className={`${style['comic-form-container']} ${style['modal-overlay'] || 'modal-overlay'}`} onClick={() => setComicDetail(null)}>
          <div className={style['comic-form-content']} onClick={(e) => e.stopPropagation()}>
            <div className={style['comic-form-header']}>
              <h3 className={style['comic-form-title']}>{comicDetail.name}</h3>
              <button type="button" className={style['comic-form-close-btn']} onClick={() => setComicDetail(null)}>
                <X size={20} />
              </button>
            </div>
            {previewLoading ? (
              <div className={style['uempty']}>Loading...</div>
            ) : (
              <div className={style['comic-form']}>
                <div className={style['comic-form-left']}>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Cover Image</label>
                    <div className={style['image-preview']}>
                      <img
                        src={comicDetail.coverUrl.startsWith('http') ? comicDetail.coverUrl : `${API_UPLOADS}${comicDetail.coverUrl}`}
                        alt={comicDetail.name}
                        className={style['preview-img']}
                      />
                    </div>
                  </div>
                  <div className={style['form-row-2col']}>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Releasing Year</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{comicDetail.releasingYear}</div>
                    </div>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Status</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{formatDisplayValue(comicDetail.releaseStatus, STATUS_OPTIONS)}</div>
                    </div>
                  </div>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Author</label>
                    <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{comicDetail.author || 'N/A'}</div>
                  </div>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Artist</label>
                    <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{comicDetail.artist || 'N/A'}</div>
                  </div>
                </div>
                <div className={style['comic-form-right']}>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Name</label>
                    <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{comicDetail.name}</div>
                  </div>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Slug</label>
                    <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{comicDetail.url}</div>
                  </div>
                  <div className={style['form-row-3col']}>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Type</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{comicDetail.types}</div>
                    </div>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Demographic</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{formatDisplayValue(comicDetail.demographic, DEMOGRAPHIC_OPTIONS)}</div>
                    </div>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Content Filter</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`} style={{ textTransform: 'capitalize' }}>{comicDetail.contentRating}</div>
                    </div>
                  </div>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Description</label>
                    <div className={`${style['form-textarea']} ${style['bg-sf-1'] || 'bg-sf-1'}`} style={{ minHeight: '132px', whiteSpace: 'pre-wrap' }}>
                      {comicDetail.description}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chapter Preview Modal */}
      {chapterDetail && (
        <div className={`${style['comic-form-container']} ${style['modal-overlay'] || 'modal-overlay'}`} onClick={() => setChapterDetail(null)}>
          <div className={style['comic-form-content']} style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className={style['comic-form-header']}>
              <h3 className={style['comic-form-title']}>{chapterDetail.title}</h3>
              <button type="button" className={style['comic-form-close-btn']} onClick={() => setChapterDetail(null)}>
                <X size={20} />
              </button>
            </div>
            {previewLoading ? (
              <div className={style['uempty']}>Loading...</div>
            ) : chapterDetail.images && chapterDetail.images.length > 0 ? (
              <div className={style['comic-form']}>
                <div className={style['form-full']}>
                  <div className={style['form-row-2col']}>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Chapter Number</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{chapterDetail.chapterNumber}</div>
                    </div>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Title</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{chapterDetail.title}</div>
                    </div>
                  </div>
                </div>
                <div className={style['form-full']}>
                  <label className={style['form-label']}>Pages ({chapterImageIndex + 1} / {chapterDetail.images.length})</label>
                  <div className={style['modal-carousel-body']} style={{ background: 'var(--bg-sf-1)', borderRadius: '8px', padding: '10px', position: 'relative' }}>
                    <img
                      src={chapterDetail.images[chapterImageIndex].urlPath.startsWith('http') ? chapterDetail.images[chapterImageIndex].urlPath : `${API_UPLOADS}${chapterDetail.images[chapterImageIndex].urlPath}`}
                      alt="Chapter page"
                      className={style['modal-image-full']}
                      style={{ maxHeight: '60vh', objectFit: 'contain', width: '100%' }}
                    />
                    <div className={style['modal-carousel-controls']} style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'space-between', padding: '0 10px', pointerEvents: 'none' }}>
                      <button
                        type="button"
                        className={`${style['ubtn']} ${style['ubtn--secondary']} ${style['ubtn--sm']}`}
                        style={{ pointerEvents: 'auto' }}
                        onClick={() => setChapterImageIndex((i) => Math.max(0, i - 1))}
                        disabled={chapterImageIndex === 0}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        className={`${style['ubtn']} ${style['ubtn--secondary']} ${style['ubtn--sm']}`}
                        style={{ pointerEvents: 'auto' }}
                        onClick={() => setChapterImageIndex((i) => Math.min(chapterDetail.images!.length - 1, i + 1))}
                        disabled={chapterImageIndex === chapterDetail.images!.length - 1}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={style['uempty']}>No images available</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}