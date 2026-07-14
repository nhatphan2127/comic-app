import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { moderationApi, comicApi, chapterApi } from '../../../services/api';
import { API_UPLOADS } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import type { Comic, Chapter } from '../../../types/types';
import { formatTimeAgo } from '../../../helpers/formatDate';
import '../../../assets/styles/ModerationPanel.css';

interface QueueItem {
  id: string;
  name?: string;
  title?: string;
  url?: string;
  coverUrl?: string;
  chapterNumber?: number;
  comicId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PreviewState {
  open: boolean;
  type: 'comic' | 'chapter' | null;
  title: string;
  data: Comic | null;
  chapter: Chapter | null;
  images: Array<{ urlPath: string; pageNumber: number }>;
  currentImageIndex: number;
}

export default function ModerationPanel() {
  const { user, isLoggedIn } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const canModerate = isLoggedIn && (role === 'moderator' || role === 'admin');

  const [queue, setQueue] = useState<{ comics: QueueItem[]; chapters: QueueItem[] }>({ comics: [], chapters: [] });
  const [allItems, setAllItems] = useState<{ comics: QueueItem[]; chapters: QueueItem[] }>({ comics: [], chapters: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ open: false, type: null, title: '', data: null, chapter: null, images: [], currentImageIndex: 0 });

  // Bộ lọc theo thiết kế của ảnh: Comic/Chapter và Trạng thái
  const [activeTab, setActiveTab] = useState<'comic' | 'chapter'>('comic');
  const [activeStatus, setActiveStatus] = useState<'pending' | 'accept' | 'reject'>('pending');

  // Quản lý ID của dòng đang được mở dropdown trạng thái
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<string | null>(null);

  // Real-time search state
  const [searchInput, setSearchInput] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Đóng dropdown khi click ra ngoài vùng menu ở mỗi dòng
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!(target as HTMLElement).closest('.row-status-fdrop')) {
        setActiveStatusDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all items for counts and current filtered items
  const loadQueue = async () => {
    if (!canModerate) {
      setQueue({ comics: [], chapters: [] });
      setAllItems({ comics: [], chapters: [] });
      setError('Please sign in as a moderator or admin to view the moderation queue.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch current filtered items based on activeStatus
      const filteredResponse = await moderationApi.getQueue(
        activeTab === 'comic' ? activeStatus : undefined,
        activeTab === 'chapter' ? activeStatus : undefined
      );
      setQueue({ comics: filteredResponse.comics || [], chapters: filteredResponse.chapters || [] });
      
      // Fetch all items (all statuses) for count badges
      const allResponse = await moderationApi.getQueue();
      setAllItems({ comics: allResponse.comics || [], chapters: allResponse.chapters || [] });
      
      setCurrentPage(1); // Reset to first page when status changes
    } catch (err: any) {
      setError(err?.message || 'Unable to load moderation queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [canModerate, user?.role, activeTab, activeStatus]);

  const handleReview = async (targetType: 'comic' | 'chapter', targetId: string, newStatus: 'accept' | 'reject') => {
    try {
      await moderationApi.review(targetType, targetId, newStatus);
      // Reload queue to update display
      await loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Unable to update submission');
    }
  };

  const previewComic = async (item: QueueItem) => {
    if (!item.url) return;
    try {
      const data = await comicApi.getByUrl(item.url as string);
      setPreview({ 
        open: true, 
        type: 'comic', 
        title: data.name || 'Comic preview', 
        data, 
        chapter: null, 
        images: [],
        currentImageIndex: 0
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to preview this comic');
    }
  };

  const previewChapter = async (item: QueueItem) => {
    try {
      const response = await chapterApi.getDetails(item.id);
      setPreview({
        open: true,
        type: 'chapter',
        title: response.title || 'Chapter preview',
        data: null,
        chapter: { id: response.id, chapterNumber: response.chapterNumber, title: response.title, url: '', createdAt: '', updatedAt: '', metadata: { currentPage: 0, totalPages: 0 } },
        images: response.images || [],
        currentImageIndex: 0,
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to preview this chapter');
    }
  };

  // Filter items by search query in real-time
  const filteredItems = useMemo(() => {
    const items = activeTab === 'comic' ? queue.comics : queue.chapters;
    
    if (searchInput.trim() === '') {
      return items;
    }

    const query = searchInput.toLowerCase().trim();
    return items.filter(item => {
      if (activeTab === 'comic') {
        return (item.name || '').toLowerCase().includes(query);
      } else {
        return (
          (item.title || '').toLowerCase().includes(query) ||
          (item.chapterNumber !== undefined && String(item.chapterNumber).includes(query))
        );
      }
    });
  }, [queue, activeTab, searchInput]);

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredItems.slice(start, end);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const handleTabChange = (tab: 'comic' | 'chapter') => {
    setActiveTab(tab);
    setSearchInput('');
    setCurrentPage(1);
  };

  const handleStatusChange = (status: 'pending' | 'accept' | 'reject') => {
    setActiveStatus(status);
    setSearchInput('');
    setCurrentPage(1);
  };

  return (
    <div className="uview">
      <div className='uview__head uview__head--row'>
        <div>
          <h2 className="uview__title">Moderation queue</h2>
          <p className="uview__sub">Review submissions, preview content, and approve or reject each item.</p>
        </div>
      </div>

      {/* Tabs chính: Comic / Chapter */}
      <div className='nfilters'>
        <div className="useg">
          <button
            type="button"
            className={`useg__btn ${activeTab === 'comic' ? 'is-on' : ''}`}
            onClick={() => handleTabChange('comic')}
          >
            Comic
          </button>
          <button
            type="button"
            className={`useg__btn ${activeTab === 'chapter' ? 'is-on' : ''}`}
            onClick={() => handleTabChange('chapter')}
          >
            Chapter
          </button>
        </div>

        <div className="useg">
          <button 
            type="button" 
            className={`useg__btn ${activeStatus === 'pending' ? 'is-on' : ''}`} 
            onClick={() => handleStatusChange('pending')}
          >
            Pending
            <span className='useg__count mono'>{allItems[activeTab === 'comic' ? 'comics' : 'chapters'].filter(item => !item.status || item.status.toLowerCase() === 'pending').length}</span>
          </button>
          <button 
            type="button" 
            className={`useg__btn ${activeStatus === 'accept' ? 'is-on' : ''}`} 
            onClick={() => handleStatusChange('accept')}
          >
            Accepted
            <span className='useg__count mono'>{allItems[activeTab === 'comic' ? 'comics' : 'chapters'].filter(item => item.status?.toLowerCase() === 'accept').length}</span>
          </button>
          <button 
            type="button" 
            className={`useg__btn ${activeStatus === 'reject' ? 'is-on' : ''}`} 
            onClick={() => handleStatusChange('reject')}
          >
            Rejected
            <span className='useg__count mono'>{allItems[activeTab === 'comic' ? 'comics' : 'chapters'].filter(item => item.status?.toLowerCase() === 'reject').length}</span>
          </button>
        </div>
      </div>

      {/* Thanh tìm kiếm real-time */}
      <div className="filter-top">
        <div className="filter-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
          </svg>
          <input
            placeholder={activeTab === 'comic' ? 'Search comics…' : 'Search chapters…'}
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="uempty">Loading moderation queue…</div>
      ) : error && !canModerate ? (
        <div className="uempty">{error}</div>
      ) : error ? (
        <div className="uempty">{error}</div>
      ) : paginatedItems.length > 0 ? (
        <>
          <div className="hgrid">
            {paginatedItems.map((item) => {
              const title = activeTab === 'comic' ? item.name || 'Untitled comic' : item.title || `Chapter ${item.chapterNumber ?? ''}`;
              const imageSrc = item.coverUrl ? `${API_UPLOADS}${item.coverUrl}` : '/images/placeholder.png';

              // Kiểm tra xem dòng này có đang mở dropdown trạng thái hay không
              const isDropdownOpen = activeStatusDropdownId === item.id;
              const currentStatus = item.status || 'pending';

              return (
                <div key={item.id} className="ulrow">
                  <div className="ulrow__poster">
                    <div className="poster poster--sm">
                      <img src={imageSrc} alt={title} loading="lazy" />
                    </div>
                  </div>
                  <div className="ulrow__body">
                    <div className="ulrow__title">{title}</div>
                    <div className="ulrow__meta">
                      <span className="ulrow__status ulrow__status--releasing">
                        {activeTab === 'comic' ? 'Comic submission' : 'Chapter submission'}
                      </span>
                      <span className="ulrow__dot" />
                      <span className="card__time">{formatTimeAgo(item.updatedAt || item.createdAt)}</span>
                      {activeTab === 'chapter' && item.chapterNumber !== undefined && (
                        <>
                          <span className="ulrow__dot" />
                          <span className="card__ch">Ch. {item.chapterNumber}</span>
                        </>
                      )}
                    </div>
                    {activeTab === 'chapter' && item.name ? <div className="ulrow__meta">{item.name}</div> : null}
                  </div>
                  <div className="ulrow__actions">
                    <button 
                      type="button" 
                      className="ubtn ubtn--ghost ubtn--sm" 
                      onClick={() => (activeTab === 'comic' ? previewComic(item) : previewChapter(item))}
                    >
                      Preview
                    </button>
                    
                    {/* Áp dụng CSS Name của Sort By cho phần Pending/Accept/Reject */}
                    <div 
                      className={`fdrop row-status-fdrop ${isDropdownOpen ? 'is-open' : ''}`} 
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
                        onClick={() => setActiveStatusDropdownId(isDropdownOpen ? null : item.id)}
                      >
                        <span className="fdrop__value" style={{ textTransform: 'capitalize' }}>
                          {currentStatus}
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
                          {['pending', 'accept', 'reject'].map((statusOption) => {
                            const isSelected = currentStatus === statusOption;
                            return (
                              <li
                                key={statusOption}
                                role="option"
                                aria-selected={isSelected}
                                className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                                onClick={() => {
                                  if (statusOption !== 'pending') {
                                    void handleReview(activeTab, item.id, statusOption as 'accept' | 'reject');
                                  }
                                  setActiveStatusDropdownId(null);
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
            })}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="upagination">
              <button
                type="button"
                className="upagination__btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : (
        /* Giao diện trạng thái trống (Empty State) */
        <div className="uempty">
          <div className="uempty__icon" />
          <div className="uempty__title">Nothing here.</div>
          <div className="uempty__sub">
            {searchInput.trim()
              ? 'No results found for your search.'
              : `No ${activeTab} submissions with ${activeStatus} status.`
            }
          </div>
        </div>
      )}

      {/* Modal Preview - Comic */}
      {preview.open && preview.type === 'comic' && preview.data && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <div>
                <h3>{preview.data.name}</h3>
                <p>{preview.data.description ? preview.data.description.substring(0, 100) + '...' : 'Comic preview'}</p>
              </div>
              <button type="button" className="btn-secondary small" onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
                Close
              </button>
            </div>
            <div className="preview-stack">
              <div className="preview-card preview-card--comic-hero">
                <div className="preview-card__thumb">
                  {preview.data.coverUrl ? (
                    <img src={`${API_UPLOADS}${preview.data.coverUrl}`} alt={preview.data.name} />
                  ) : (
                    <div style={{ backgroundColor: 'var(--surface-2)', width: '100%', height: '100%' }} />
                  )}
                </div>
                <div className="preview-card__info">
                  <h4>{preview.data.name}</h4>
                  <p>{preview.data.description || 'No description provided.'}</p>
                  <div className="meta-row">
                    {preview.data.types && <span className="stat-pill">{preview.data.types}</span>}
                    {preview.data.demographic && <span className="stat-pill">{preview.data.demographic}</span>}
                  </div>
                </div>
              </div>
              <div className="preview-card">
                <h4>Chapters ({preview.data?.latestChapters?.length || 0})</h4>
                <ul className="preview-list">
                  {(preview.data?.latestChapters || []).slice(0, 8).map((chapter: Chapter) => (
                    <li key={chapter.id}>{chapter.title || `Chapter ${chapter.chapterNumber}`}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview - Chapter with image carousel */}
      {preview.open && preview.type === 'chapter' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
          <div className="modal-card modal-card--chapter" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <div>
                <h3>{preview.chapter?.title || 'Chapter preview'}</h3>
                <p>Chapter {preview.chapter?.chapterNumber || ''}</p>
              </div>
              <button type="button" className="btn-secondary small" onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
                Close
              </button>
            </div>
            {preview.images && preview.images.length > 0 ? (
              <div className="chapter-preview-carousel">
                <div className="carousel-viewer">
                  <img
                    src={`${API_UPLOADS}${preview.images[preview.currentImageIndex].urlPath}`}
                    alt={`Page ${preview.images[preview.currentImageIndex].pageNumber}`}
                    style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }}
                  />
                </div>
                <div className="carousel-controls">
                  <button
                    type="button"
                    onClick={() => setPreview(prev => ({
                      ...prev,
                      currentImageIndex: Math.max(0, prev.currentImageIndex - 1)
                    }))}
                    disabled={preview.currentImageIndex === 0}
                    style={{ opacity: preview.currentImageIndex === 0 ? 0.5 : 1 }}
                    className="carousel-btn"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="carousel-counter" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                    {preview.currentImageIndex + 1} / {preview.images.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreview(prev => ({
                      ...prev,
                      currentImageIndex: Math.min(prev.images.length - 1, prev.currentImageIndex + 1)
                    }))}
                    disabled={preview.currentImageIndex === preview.images.length - 1}
                    style={{ opacity: preview.currentImageIndex === preview.images.length - 1 ? 0.5 : 1 }}
                    className="carousel-btn"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="uempty" style={{ padding: '60px 20px' }}>
                <div className="uempty__title">No images found</div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}