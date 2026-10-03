import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { moderationApi, chapterApi } from '../../../../services/api';
import { API_UPLOADS } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import type { Comic, Chapter, ComicDetail, ChapterDetail } from '../../../../types/types';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import { formatDisplayValue } from '../../../../helpers/utils';
import { DEMOGRAPHIC_OPTIONS, STATUS_OPTIONS, CONTENT_FILTER } from '../ComicSuggestionPanel/ComicSuggestionPanel';
import style from './ModerationPanel.module.css';

const ALL_GENRES = [
  'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi',
  'Fantasy', 'Girls Love', 'Harem', 'Hentai', 'Historical', 'Horror', 'Isekai',
  'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports',
  'Superhero', 'Thriller', 'Tragedy', 'Wuxia'
];

const ALL_FORMATS = [
  '4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi',
  'Full Color', 'Long Strip', 'Oneshot', 'Web Comic'
];

interface PreviewState {
  open: boolean;
  type: 'comic' | 'chapter' | null;
  title: string;
  comic: ComicDetail | null;
  chapter: ChapterDetail | null;
  currentImageIndex: number;
  isLoading?: boolean;
}

export default function ModerationPanel() {
  const { user, isLoggedIn } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const canModerate = isLoggedIn && (role === 'moderator' || role === 'admin');

  const [queue, setQueue] = useState<{ comics: Comic[]; chapters: Chapter[] }>({ comics: [], chapters: [] });
  const [allItems, setAllItems] = useState<{ comics: Comic[]; chapters: Chapter[] }>({ comics: [], chapters: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ open: false, type: null, title: '', comic: null, chapter: null, currentImageIndex: 0 });

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
      const targetClass = style['row-status-fdrop'] || 'row-status-fdrop';
      if (!(target as HTMLElement).closest(`.${targetClass}`)) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Unable to load moderation queue');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Unable to update submission');
    }
  };

  const previewComic = async (item: Comic) => {
    setPreview(prev => ({ ...prev, open: true, type: 'comic', isLoading: true }));
    try {
      const data = await moderationApi.getComicDetail(item.id);
      setPreview({
        open: true,
        type: 'comic',
        title: data.name || 'Comic preview',
        comic: data,
        chapter: null,
        currentImageIndex: 0,
        isLoading: false
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to preview this comic');
      setPreview(prev => ({ ...prev, open: false, isLoading: false }));
    }
  };

  const previewChapter = async (item: Chapter) => {
    setPreview(prev => ({ ...prev, open: true, type: 'chapter', isLoading: true }));
    try {
      const response = await chapterApi.getDetails(item.id);
      setPreview({
        open: true,
        type: 'chapter',
        title: response.title || 'Chapter preview',
        comic: null,
        chapter: response,
        currentImageIndex: 0,
        isLoading: false
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to preview this chapter');
      setPreview(prev => ({ ...prev, open: false, isLoading: false }));
    }
  };

  // Filter items by search query in real-time
  const filteredItems = useMemo(() => {
    if (activeTab === 'comic') {
      const items = queue.comics;
      if (searchInput.trim() === '') return items;
      const query = searchInput.toLowerCase().trim();
      return items.filter(item => (item.name || '').toLowerCase().includes(query));
    } else {
      const items = queue.chapters;
      if (searchInput.trim() === '') return items;
      const query = searchInput.toLowerCase().trim();
      return items.filter(item => (
        (item.title || '').toLowerCase().includes(query) ||
        String(item.chapterNumber).includes(query)
      ));
    }
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
    <div className={style['uview']}>
      <div className={`${style['uview__head']} ${style['uview__head--row']}`}>
        <div>
          <h2 className={style['uview__title']}>Moderation queue</h2>
          <p className={style['uview__sub']}>Review submissions, preview content, and approve or reject each item.</p>
        </div>
      </div>

      {/* Tabs chính: Comic / Chapter */}
      <div className={style['nfilters']}>
        <div className={style['useg']}>
          <button
            type="button"
            className={`${style['useg__btn']} ${activeTab === 'comic' ? style['is-on'] || 'is-on' : ''}`}
            onClick={() => handleTabChange('comic')}
          >
            Comic
          </button>
          <button
            type="button"
            className={`${style['useg__btn']} ${activeTab === 'chapter' ? style['is-on'] || 'is-on' : ''}`}
            onClick={() => handleTabChange('chapter')}
          >
            Chapter
          </button>
        </div>

        <div className={style['useg']}>
          <button
            type="button"
            className={`${style['useg__btn']} ${activeStatus === 'pending' ? style['is-on'] || 'is-on' : ''}`}
            onClick={() => handleStatusChange('pending')}
          >
            <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{allItems[activeTab === 'comic' ? 'comics' : 'chapters'].filter(item => !item.status || item.status.toLowerCase() === 'pending').length}</span>
            Pending
          </button>
          <button
            type="button"
            className={`${style['useg__btn']} ${activeStatus === 'accept' ? style['is-on'] || 'is-on' : ''}`}
            onClick={() => handleStatusChange('accept')}
          >
            <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{allItems[activeTab === 'comic' ? 'comics' : 'chapters'].filter(item => item.status?.toLowerCase() === 'accept').length}</span>
            Accepted
          </button>
          <button
            type="button"
            className={`${style['useg__btn']} ${activeStatus === 'reject' ? style['is-on'] || 'is-on' : ''}`}
            onClick={() => handleStatusChange('reject')}
          >
            <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{allItems[activeTab === 'comic' ? 'comics' : 'chapters'].filter(item => item.status?.toLowerCase() === 'reject').length}</span>
            Rejected
          </button>
        </div>
      </div>

      {/* Thanh tìm kiếm real-time */}
      <div className={style['filter-top']}>
        <div className={style['filter-search']}>
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
        <div className={style['uempty']}>Loading moderation queue…</div>
      ) : error && !canModerate ? (
        <div className={style['uempty']}>{error}</div>
      ) : error ? (
        <div className={style['uempty']}>{error}</div>
      ) : paginatedItems.length > 0 ? (
        <>
          <div className={style['hgrid']}>
            {paginatedItems.map((item) => {
              const isComic = activeTab === 'comic';
              const comicItem = isComic ? (item as Comic) : null;
              const chapterItem = !isComic ? (item as Chapter) : null;

              const title = isComic ? comicItem?.name || 'Untitled comic' : chapterItem?.title || `Chapter ${chapterItem?.chapterNumber ?? ''}`;
              const imageSrc = isComic && comicItem?.coverUrl ? `${API_UPLOADS}${comicItem.coverUrl}` : '/images/placeholder.png';

              // Kiểm tra xem dòng này có đang mở dropdown trạng thái hay không
              const isDropdownOpen = activeStatusDropdownId === item.id;
              const currentStatus = item.status || 'pending';

              return (
                <div key={item.id} className={style['ulrow']}>
                  <div className={style['ulrow__poster']}>
                    <div className={`${style['poster']} ${style['poster--sm']}`}>
                      <img src={imageSrc} alt={title} loading="lazy" />
                    </div>
                  </div>
                  <div className={style['ulrow__body']}>
                    <div className={style['ulrow__title']}>{title}</div>
                    <div className={style['ulrow__meta']}>
                      <span className={`${style['ulrow__status']} ${style['ulrow__status--releasing']}`}>
                        {isComic ? 'Comic submission' : 'Chapter submission'}
                      </span>
                      <span className={style['ulrow__dot']} />
                      <span className={style['card__time']}>{formatTimeAgo(item.updatedAt || (isComic ? comicItem?.createdAt : chapterItem?.createdAt))}</span>
                      {!isComic && chapterItem?.chapterNumber !== undefined && (
                        <>
                          <span className={style['ulrow__dot']} />
                          <span className={style['card__ch']}>Ch. {chapterItem.chapterNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={style['ulrow__actions']}>
                    <button
                      type="button"
                      className={`${style['ubtn']} ${style['ubtn--ghost']} ${style['ubtn--sm']}`}
                      onClick={() => (isComic ? previewComic(comicItem!) : previewChapter(chapterItem!))}
                    >
                      Preview
                    </button>

                    {/* Áp dụng CSS Name của Sort By cho phần Pending/Accept/Reject */}
                    <div
                      className={`${style['fdrop']} ${style['row-status-fdrop']} ${isDropdownOpen ? style['is-open'] || 'is-open' : ''}`}
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
                        onClick={() => setActiveStatusDropdownId(isDropdownOpen ? null : item.id)}
                      >
                        <span className={style['fdrop__value']} style={{ textTransform: 'capitalize' }}>
                          {currentStatus}
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
                          {['pending', 'accept', 'reject'].map((statusOption) => {
                            const isSelected = currentStatus === statusOption;
                            return (
                              <li
                                key={statusOption}
                                role="option"
                                aria-selected={isSelected}
                                className={`${style['fdrop__item']} ${isSelected ? style['is-active'] || 'is-active' : ''}`}
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
            <div className={style['upagination']}>
              <button
                type="button"
                className={style['upagination__btn']}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
        <div className={style['uempty']}>
          <div className={style['uempty__icon']} />
          <div className={style['uempty__title']}>Nothing here.</div>
          <div className={style['uempty__sub']}>
            {searchInput.trim()
              ? 'No results found for your search.'
              : `No ${activeTab} submissions with ${activeStatus} status.`
            }
          </div>
        </div>
      )}

      {/* Comic Preview Modal */}
      {preview.open && preview.type === 'comic' && (
        <div className={style['modal-overlay'] || 'modal-overlay'} onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
          <div className={style['comic-form-container']} style={{ width: 'min(1120px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className={style['comic-form-header']}>
              <h3 className={style['comic-form-title']}>{preview.comic?.name || 'Comic Preview'}</h3>
              <button type="button" className={style['comic-form-close-btn']} onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
                <X size={20} />
              </button>
            </div>
            {preview.isLoading ? (
              <div className={style['uempty']}>Loading...</div>
            ) : preview.comic ? (
              <div className={style['comic-form']}>
                {/* LEFT COLUMN */}
                <div className={style['comic-form-left']}>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Image</label>
                    <div className={style['image-upload-box']}>
                      <div className={style['image-preview']}>
                        <img
                          src={preview.comic.coverUrl?.startsWith('http') ? preview.comic.coverUrl : `${API_UPLOADS}${preview.comic.coverUrl}`}
                          alt="Comic preview"
                          className={style['preview-img']}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={style['form-row-2col']}>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Releasing Year</label>
                      <input
                        type="number"
                        className={style['form-input']}
                        value={preview.comic.releasingYear}
                        disabled
                      />
                    </div>

                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Releasing Status</label>
                      <button type="button" className={`${style['fdrop__btn']} ${style['form-input']}`} disabled>
                        <span className={style['fdrop__value']}>{formatDisplayValue(preview.comic.releaseStatus, STATUS_OPTIONS) || 'Choose status'}</span>
                      </button>
                    </div>
                  </div>

                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Author</label>
                    <input
                      type="text"
                      className={style['form-input']}
                      value={preview.comic.author || ''}
                      disabled
                    />
                  </div>

                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Artist</label>
                    <input
                      type="text"
                      className={style['form-input']}
                      value={preview.comic.artist || ''}
                      disabled
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className={style['comic-form-right']}>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Name</label>
                    <input
                      type="text"
                      className={style['form-input']}
                      value={preview.comic.name}
                      disabled
                    />
                  </div>

                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Slug</label>
                    <input
                      type="text"
                      className={style['form-input']}
                      value={preview.comic.url}
                      disabled
                    />
                  </div>

                  <div className={style['form-row-3col']}>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Type</label>
                      <button type="button" className={`${style['fdrop__btn']} ${style['form-input']}`} disabled>
                        <span className={style['fdrop__value']}>{preview.comic.types || 'Choose type'}</span>
                      </button>
                    </div>

                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Demographic</label>
                      <button type="button" className={`${style['fdrop__btn']} ${style['form-input']}`} disabled>
                        <span className={style['fdrop__value']}>{formatDisplayValue(preview.comic.demographic, DEMOGRAPHIC_OPTIONS) || 'Choose demographic'}</span>
                      </button>
                    </div>

                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Content Filter</label>
                      <button type="button" className={`${style['fdrop__btn']} ${style['form-input']}`} disabled>
                        <span className={style['fdrop__value']}>{formatDisplayValue(preview.comic.contentRating, CONTENT_FILTER) || 'Choose filter'}</span>
                      </button>
                    </div>
                  </div>

                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Other Names & Countries (per line)</label>
                    <textarea
                      className={style['form-textarea']}
                      value={preview.comic.names?.map(n => `${n.name},${n.country}`).join('\n') || ''}
                      disabled
                      rows={3}
                    />
                  </div>
                  
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Description</label>
                    <textarea
                      style={{ minHeight: '132px' }}
                      className={style['form-textarea']}
                      value={preview.comic.description || ''}
                      disabled
                      rows={4}
                    />
                  </div>

                </div>

                {/* Formats - FULL WIDTH */}
                <div className={style['form-full']}>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Formats</label>
                    <div className={style['direct-tags-box']}>
                      <ul className={style['direct-tags-grid']}>
                        {ALL_FORMATS.map((format) => {
                          const isSelected = preview.comic?.formats?.includes(format);
                          return (
                            <li key={format}>
                              <button
                                type="button"
                                className={`${style['tagpop__item']} ${isSelected ? style['tag-on'] || 'tag-on' : style['tag-off'] || 'tag-off'}`}
                                disabled
                                style={{ opacity: 1, cursor: 'default' }}
                              >
                                <span className={style['tagpop__check']} aria-hidden="true"></span>
                                <span className={style['tagpop__name']}>{format}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Genres - FULL WIDTH */}
                <div className={style['form-full']}>
                  <div className={style['form-group']}>
                    <label className={style['form-label']}>Genres</label>
                    <div className={style['direct-tags-box']}>
                      <ul className={style['direct-tags-grid']}>
                        {ALL_GENRES.map((genre) => {
                          const isSelected = preview.comic?.genres?.includes(genre);
                          return (
                            <li key={genre}>
                              <button
                                type="button"
                                className={`${style['tagpop__item']} ${isSelected ? style['tag-on'] || 'tag-on' : style['tag-off'] || 'tag-off'}`}
                                disabled
                                style={{ opacity: 1, cursor: 'default' }}
                              >
                                <span className={style['tagpop__check']} aria-hidden="true"></span>
                                <span className={style['tagpop__name']}>{genre}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Chapter Preview Modal */}
      {preview.open && preview.type === 'chapter' && (
        <div className={`${style['comic-form-container']} ${style['modal-overlay'] || 'modal-overlay'}`} onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
          <div className={style['comic-form-content']} style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className={style['comic-form-header']}>
              <h3 className={style['comic-form-title']}>{preview.chapter?.title || 'Chapter Preview'}</h3>
              <button type="button" className={style['comic-form-close-btn']} onClick={() => setPreview(prev => ({ ...prev, open: false }))}>
                <X size={20} />
              </button>
            </div>
            {preview.isLoading ? (
              <div className={style['uempty']}>Loading...</div>
            ) : preview.chapter?.images && preview.chapter.images.length > 0 ? (
              <div className={style['comic-form']}>
                <div className={style['form-full']}>
                  <div className={style['form-row-2col']}>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Chapter Number</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{preview.chapter.chapterNumber}</div>
                    </div>
                    <div className={style['form-group']}>
                      <label className={style['form-label']}>Title</label>
                      <div className={`${style['form-input']} ${style['bg-sf-1'] || 'bg-sf-1'}`}>{preview.chapter.title}</div>
                    </div>
                  </div>
                </div>
                <div className={style['form-full']}>
                  <label className={style['form-label']}>Pages ({preview.currentImageIndex + 1} / {preview.chapter.images.length})</label>
                  <div className={style['modal-carousel-body']} style={{ background: 'var(--bg-sf-1)', borderRadius: '8px', padding: '10px', position: 'relative' }}>
                    <img
                      src={`${API_UPLOADS}${preview.chapter.images[preview.currentImageIndex].urlPath}`}
                      alt="Chapter page"
                      className={style['modal-image-full']}
                      style={{ maxHeight: '60vh', objectFit: 'contain', width: '100%' }}
                    />
                    <div className={style['modal-carousel-controls']} style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'space-between', padding: '0 10px', pointerEvents: 'none' }}>
                      <button
                        type="button"
                        className={`${style['ubtn']} ${style['ubtn--secondary']} ${style['ubtn--sm']}`}
                        style={{ pointerEvents: 'auto' }}
                        onClick={() => setPreview(prev => ({ ...prev, currentImageIndex: Math.max(0, prev.currentImageIndex - 1) }))}
                        disabled={preview.currentImageIndex === 0}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        className={`${style['ubtn']} ${style['ubtn--secondary']} ${style['ubtn--sm']}`}
                        style={{ pointerEvents: 'auto' }}
                        onClick={() => setPreview(prev => ({ ...prev, currentImageIndex: Math.min(preview.chapter!.images!.length - 1, prev.currentImageIndex + 1) }))}
                        disabled={preview.currentImageIndex === preview.chapter.images.length - 1}
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