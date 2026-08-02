import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { UserFollowingCategory, FollowingComic } from '../../../types/types';

import { ComicCard, ComicRow } from '../../../components/FollowingComic';
import { comicApi, userApi } from '../../../services/api';
import { toggleArrayItem, getDisplayValue, getGenresDisplayValue } from '../../../helpers/utils';

// Danh sách dữ liệu cố định cho các bộ lọc
const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'];
const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];
const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'];

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

// Định nghĩa 13 tùy chọn Sort By
const SORT_OPTIONS = [
  { key: 'updated_desc', label: 'Recently updated' },
  { key: 'updated_asc', label: 'Least recently updated' },
  { key: 'added_desc', label: 'Recently added' },
  { key: 'added_asc', label: 'Oldest added' },
  { key: 'read_desc', label: 'Recently read' },
  { key: 'read_asc', label: 'Least recently read' },
  { key: 'title_asc', label: 'Title A → Z' },
  { key: 'title_desc', label: 'Title Z → A' },
  { key: 'year_desc', label: 'Year (newest)' },
  { key: 'year_asc', label: 'Year (oldest)' },
  { key: 'score_desc', label: 'Score (high → low)' },
  { key: 'score_asc', label: 'Score (low → high)' },
  { key: 'match', label: 'Best match' },
];

export default function FollowingTitlesPanel() {
  const [allComics, setAllComics] = useState<FollowingComic[]>([]);
  const [folders, setFolders] = useState<UserFollowingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode] = useState<'grid' | 'list'>('list');
  
  // Khởi tạo trạng thái sort mặc định là 'updated_desc' (Recently updated)
  const [subTab, setSubTab] = useState<string>('updated_desc');
  
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAdvancedOpen] = useState<boolean>(true);
  const [isEditFoldersOpen, setIsEditFoldersOpen] = useState<boolean>(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);

  // --- States mở dropdown ---
  const [isTypesOpen, setIsTypesOpen] = useState(false);
  const [isGenresOpen, setIsGenresOpen] = useState(false);
  const [isDemographicOpen, setIsDemographicOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  // --- States bộ lọc đã chọn ---
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  
  const [genreMatchMode, setGenreMatchMode] = useState<'AND' | 'OR'>('AND');
  const [genreSearch, setGenreSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // --- Refs quản lý click ra ngoài dropdown ---
  const editFoldersRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const typesRef = useRef<HTMLDivElement>(null);
  const genresRef = useRef<HTMLDivElement>(null);
  const demographicRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Xử lý click ngoài dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (editFoldersRef.current && !editFoldersRef.current.contains(target)) setIsEditFoldersOpen(false);
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) setIsSortMenuOpen(false);
      if (typesRef.current && !typesRef.current.contains(target)) setIsTypesOpen(false);
      if (genresRef.current && !genresRef.current.contains(target)) setIsGenresOpen(false);
      if (demographicRef.current && !demographicRef.current.contains(target)) setIsDemographicOpen(false);
      if (statusRef.current && !statusRef.current.contains(target)) setIsStatusOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [comics, categories] = await Promise.all([
        userApi.getFollowingList(), 
        userApi.getFollowingCategories()
      ]);
      setAllComics(comics || []);
      setFolders(categories || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Tự động reset về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFolderId, selectedTypes, selectedDemographics, selectedStatuses, selectedGenres, selectedFormats, genreMatchMode, subTab]);
  // --- Logic lọc và sắp xếp chính ---
  const filteredComics = useMemo(() => {
    let result = [...allComics];
    const query = searchQuery.trim().toLowerCase();

    // 1. Tìm kiếm theo tên
    if (query) {
      result = result.filter((item) => {
        const title = `${item.comic.name || (item.comic as unknown as { title: string }).title || ''}`.toLowerCase();
        return title.includes(query);
      });
    }

    // 2. Lọc theo Folder
    if (activeFolderId) {
      result = result.filter((item) => item.category?.id === activeFolderId);
    }

    // 3. Lọc theo TYPES
    if (selectedTypes.length > 0) {
      result = result.filter((item) => {
        const comicType = (item.comic.types || (item.comic as unknown as { type: string }).type || '').toLowerCase();
        return selectedTypes.some((t) => t.toLowerCase() === comicType);
      });
    }

    // 4. Lọc theo DEMOGRAPHIC
    if (selectedDemographics.length > 0) {
      result = result.filter((item) => {
        const demo = (item.comic.demographic || (item.comic as unknown as { demographic: string }).demographic || '').toLowerCase();
        return selectedDemographics.some((d) => d.toLowerCase() === demo);
      });
    }

    // 5. Lọc theo RELEASE STATUS
    if (selectedStatuses.length > 0) {
      result = result.filter((item) => {
        const status = (item.comic.releaseStatus || (item.comic as unknown as { status: string }).status || '').toLowerCase().replace(/\s+/g, '');
        return selectedStatuses.some((s) => {
          const targetStatus = s.toLowerCase().replace(/\s+/g, '');
          return status === targetStatus;
        });
      });
    }

    // 6. Lọc theo GENRES & FORMATS (AND / OR)
    const hasGenreFilters = selectedGenres.length > 0 || selectedFormats.length > 0;
    if (hasGenreFilters) {
      const lowerSelectedGenres = selectedGenres.map((g) => g.toLowerCase());
      const lowerSelectedFormats = selectedFormats.map((f) => f.toLowerCase());

      result = result.filter((item) => {
        const comicGenres: string[] = Array.isArray(item.comic.genres)
          ? item.comic.genres.map((g: string | { name: string }) => (typeof g === 'string' ? g.toLowerCase() : (g.name || '').toLowerCase()))
          : [];

        const rawFormats = (item.comic as unknown as { formats: string[] }).formats || item.comic.formats || [];
        const comicFormats: string[] = Array.isArray(rawFormats)
          ? rawFormats.map((f: string | { name: string }) => (typeof f === 'string' ? f.toLowerCase() : (f.name || '').toLowerCase()))
          : typeof rawFormats === 'string'
          ? [(rawFormats as string).toLowerCase()]
          : [];

        const matchedGenres = lowerSelectedGenres.filter((g) => comicGenres.includes(g));
        const matchedFormats = lowerSelectedFormats.filter((f) => comicFormats.includes(f));
        
        const totalMatches = matchedGenres.length + matchedFormats.length;
        const totalRequired = lowerSelectedGenres.length + lowerSelectedFormats.length;

        if (genreMatchMode === 'AND') {
          return totalMatches === totalRequired;
        } else {
          return totalMatches > 0;
        }
      });
    }

    // 7. Sắp xếp danh sách (Hỗ trợ toàn bộ 13 thuật toán Sort)
    const getDateVal = (d?: string | null) => (d ? new Date(d).getTime() : 0);

    return result.sort((a, b) => {
      switch (subTab) {
        case 'updated_desc': {
          const dateA = getDateVal(a.comic.updatedAt || a.updatedAt);
          const dateB = getDateVal(b.comic.updatedAt || b.updatedAt);
          return dateB - dateA || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'updated_asc': {
          const dateA = getDateVal(a.comic.updatedAt || a.updatedAt);
          const dateB = getDateVal(b.comic.updatedAt || b.updatedAt);
          if (dateA === 0) return 1;
          if (dateB === 0) return -1;
          return dateA - dateB || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'added_desc': {
          const dateA = getDateVal(a.updatedAt || a.comic.updatedAt);
          const dateB = getDateVal(b.updatedAt || b.comic.updatedAt);
          return dateB - dateA || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'added_asc': {
          const dateA = getDateVal(a.updatedAt || a.comic.updatedAt);
          const dateB = getDateVal(b.updatedAt || b.comic.updatedAt);
          if (dateA === 0) return 1;
          if (dateB === 0) return -1;
          return dateA - dateB || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'read_desc': {
          const dateA = getDateVal(a.updatedAt || a.comic.updatedAt);
          const dateB = getDateVal(b.updatedAt || b.comic.updatedAt);
          return dateB - dateA || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'read_asc': {
          const dateA = getDateVal(a.updatedAt || a.comic.updatedAt);
          const dateB = getDateVal(b.updatedAt || b.comic.updatedAt);
          if (dateA === 0) return 1;
          if (dateB === 0) return -1;
          return dateA - dateB || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'title_asc': {
          return (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'title_desc': {
          return (b.comic.name || '').localeCompare(a.comic.name || '');
        }
        case 'year_desc': {
          const yearA = Number(a.comic.releasingYear || (a.comic as unknown as { releaseYear: string }).releaseYear || 0);
          const yearB = Number(b.comic.releasingYear || (b.comic as unknown as { releaseYear: string }).releaseYear || 0);
          return yearB - yearA || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'year_asc': {
          const yearA = Number(a.comic.releasingYear || (a.comic as unknown as { releaseYear: string }).releaseYear || 9999);
          const yearB = Number(b.comic.releasingYear || (b.comic as unknown as { releaseYear: string }).releaseYear || 9999);
          return yearA - yearB || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'score_desc': {
          const scoreA = Number((a.comic as unknown as { score: number }).score || (a.comic as unknown as { rating: number }).rating || 0);
          const scoreB = Number((b.comic as unknown as { score: number }).score || (b.comic as unknown as { rating: number }).rating || 0);
          return scoreB - scoreA || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'score_asc': {
          const scoreA = Number((a.comic as unknown as { score: number }).score || (a.comic as unknown as { rating: number }).rating || 0);
          const scoreB = Number((b.comic as unknown as { score: number }).score || (b.comic as unknown as { rating: number }).rating || 0);
          return scoreA - scoreB || (a.comic.name || '').localeCompare(b.comic.name || '');
        }
        case 'match':
        default: {
          return (a.comic.name || '').localeCompare(b.comic.name || '');
        }
      }
    });
  }, [allComics, searchQuery, activeFolderId, selectedTypes, selectedDemographics, selectedStatuses, selectedGenres, selectedFormats, genreMatchMode, subTab]);

  // Khôi phục bộ lọc
  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveFolderId(null);
    setSubTab('updated_desc');
    setIsSortMenuOpen(false);
    setSelectedTypes([]);
    setSelectedDemographics([]);
    setSelectedStatuses([]);
    setSelectedGenres([]);
    setSelectedFormats([]);
    setGenreMatchMode('AND');
    setGenreSearch('');
  };

  // --- UI helpers moved to shared utils: toggleArrayItem, getDisplayValue, getGenresDisplayValue ---

  const handleUnfollow = async (comicId: string) => {
    try {
      await comicApi.unfollow(comicId);
      setAllComics((prev) => prev.filter((item) => item.comic.id !== comicId));
    } catch (err) {
      console.error('Error during unfollow:', err);
      alert('Failed to unfollow comic. Please try again.');
    }
  };

  const handleAddFolder = async () => {
    const category = window.prompt('Folder name');
    if (!category) return;
    try {
      const created = await userApi.createFollowingCategory(category);
      setFolders((prev) => [...prev, created]);
      setIsEditFoldersOpen(false);
    } catch (err) {
      console.error(err);
      alert('Unable to add folder');
    }
  };

  const handleEditFolder = async (folder: UserFollowingCategory) => {
    const category = window.prompt('Rename folder', folder.category);
    if (!category) return;
    try {
      const updated = await userApi.updateFollowingCategory(folder.id, category);
      setFolders((prev) => prev.map((item) => item.id === folder.id ? { ...item, category: updated.category } : item));
      setIsEditFoldersOpen(false);
    } catch (err) {
      console.error(err);
      alert('Unable to rename folder');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Delete this folder and keep the followed titles in the library?')) return;
    try {
      await userApi.deleteFollowingCategory(folderId);
      setFolders((prev) => prev.filter((item) => item.id !== folderId));
      setAllComics((prev) => prev.map((item) => item.category?.id === folderId ? { ...item, category: null } : item));
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
      setIsEditFoldersOpen(false);
    } catch (err) {
      console.error(err);
      alert('Unable to delete folder');
    }
  };

  const handleMoveCategory = async (comicId: string, categoryId: string | null) => {
    try {
      await userApi.updateFollowingComicCategory(comicId, categoryId);
      setAllComics((prev) => prev.map((item) => {
        if (item.comic.id === comicId) {
          const matchedFolder = categoryId ? folders.find((folder) => folder.id === categoryId) || null : null;
          return { ...item, category: matchedFolder ?? null };
        }
        return item;
      }));
    } catch (err) {
      console.error(err);
      alert('Unable to move title');
    }
  };

  const totalPages = Math.ceil(filteredComics.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedComics = filteredComics.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="user-content">
      <div className="uview">
        <div className="uview__head uview__head--row">
          <div>
            <h2 className="uview__title">Following Titles</h2>
            <p className="uview__sub">
              {filteredComics.length} {filteredComics.length === 1 ? 'title' : 'titles'} in your library.
            </p>
          </div>
          <div className="uview__head-tools">
            <div className={`fdrop ${isEditFoldersOpen ? 'is-open' : ''}`} ref={editFoldersRef}>
              <button
                type="button"
                className="useg__btn"
                aria-haspopup="menu"
                aria-expanded={isEditFoldersOpen}
                aria-label="Edit folders"
                onClick={() => setIsEditFoldersOpen(!isEditFoldersOpen)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4l10-10-4-4L4 16v4z"></path>
                  <path d="M14 6l4 4"></path>
                </svg>
                <span>Edit folders</span>
              </button>

              {isEditFoldersOpen && (
                <div className="fdrop__pop fdrop__pop--menu" role="menu">
                  {folders.map((folder) => (
                    <div className="fdrop__row" key={folder.id}>
                      <span className="fdrop__row-label">{folder.category}</span>
                      <div className="fdrop__row-actions">
                        <button type="button" className="fdrop__icon-btn" aria-label={`Edit ${folder.category}`} onClick={() => void handleEditFolder(folder)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 20h4l10-10-4-4L4 16v4z"></path>
                            <path d="M14 6l4 4"></path>
                          </svg>
                        </button>
                        <button type="button" className="fdrop__icon-btn fdrop__icon-btn--danger" aria-label={`Delete ${folder.category}`} onClick={() => void handleDeleteFolder(folder.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="fdrop__sep"></div>
                  <button type="button" className="fdrop__item fdrop__item--add" onClick={() => void handleAddFolder()}>
                    <span className="fdrop__item-check" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"></path>
                      </svg>
                    </span>
                    <span>Add folder</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="uview__folders-row">
          <div className="uview__folders">
            <div className="useg useg--scroll">
              <button type="button" className={`useg__btn ${activeFolderId === null ? 'is-on' : ''}`} onClick={() => setActiveFolderId(null)}>All</button>
              {folders.map((folder) => (
                <button key={folder.id} type="button" className={`useg__btn ${activeFolderId === folder.id ? 'is-on' : ''}`} onClick={() => setActiveFolderId(folder.id)}>{folder.category}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="uview__filter-block">
          <div className="filter-top">
            <div className="filter-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
              </svg>
              <input placeholder="Search your library…" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button type="button" className={`btn btn--soft filter-adv-toggle ${isAdvancedOpen ? 'is-on' : ''}`} aria-expanded={isAdvancedOpen} onClick={handleResetFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              RESET FILTERS
            </button>
          </div>

          <div style={{ height: isAdvancedOpen ? 'auto' : '0', overflow: isAdvancedOpen ? 'visible' : 'hidden', transition: 'height 220ms' }}>
            <div className="filter-grid">
              
              {/* SORT BY */}
              <div className={`fdrop ${isSortMenuOpen ? 'is-open' : ''}`} ref={sortMenuRef}>
                <label className="fdrop__label mono">SORT BY</label>
                <button 
                  type="button" 
                  className="fdrop__btn" 
                  aria-haspopup="listbox" 
                  aria-expanded={isSortMenuOpen} 
                  onClick={() => setIsSortMenuOpen((prev) => !prev)}
                >
                  <span className="fdrop__value">
                    {SORT_OPTIONS.find((option) => option.key === subTab)?.label ?? 'Recently updated'}
                  </span>
                  <svg className="fdrop__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isSortMenuOpen && (
                  <ul className="fdrop__pop" role="listbox" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {SORT_OPTIONS.map((option) => {
                      const isSelected = subTab === option.key;
                      return (
                        <li
                          key={option.key}
                          role="option"
                          aria-selected={isSelected}
                          className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                          onClick={() => {
                            setSubTab(option.key);
                            setIsSortMenuOpen(false);
                          }}
                        >
                          <span className={`fdrop__check fdrop__check--radio ${isSelected ? 'is-checked' : ''}`} aria-hidden="true">
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </span>
                          {option.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* TYPES */}
              <div className={`fdrop ${isTypesOpen ? 'is-open' : ''}`} ref={typesRef}>
                <label className="fdrop__label mono">TYPES</label>
                <button type="button" className="fdrop__btn" aria-haspopup="listbox" aria-expanded={isTypesOpen} onClick={() => setIsTypesOpen(!isTypesOpen)}>
                  <span className="fdrop__value">{getDisplayValue(selectedTypes)}</span>
                  <svg className="fdrop__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isTypesOpen && (
                  <div className="fdrop__pop fdrop__pop--multi">
                    <ul className="fdrop__list" role="listbox">
                      {TYPE_OPTIONS.map((type) => {
                        const isSelected = selectedTypes.includes(type);
                        return (
                          <li
                            key={type}
                            role="option"
                            aria-selected={isSelected}
                            className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                            onClick={() => setSelectedTypes((prev) => toggleArrayItem(prev, type))}
                          >
                            <span className={`fdrop__check fdrop__check--box ${isSelected ? 'is-checked' : ''}`} aria-hidden="true">
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </span>
                            {type}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* GENRES */}
              <div className={`fdrop fdrop--tags ${isGenresOpen ? 'is-open' : ''}`} ref={genresRef}>
                <label className="fdrop__label mono">GENRES</label>
                <button type="button" className="fdrop__btn" aria-haspopup="listbox" aria-expanded={isGenresOpen} onClick={() => setIsGenresOpen(!isGenresOpen)}>
                  <span className="fdrop__value">{getGenresDisplayValue(selectedGenres, selectedFormats)}</span>
                  <svg className="fdrop__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isGenresOpen && (
                  <div className="fdrop__pop fdrop__pop--multi fdrop__pop--tags">
                    <div className="fdrop__toolbar">
                      <span className="fdrop__foot-label mono">Match</span>
                      <div className="fdrop__seg">
                        <button
                          type="button"
                          className={`fdrop__seg-btn ${genreMatchMode === 'AND' ? 'is-on' : ''}`}
                          onClick={() => setGenreMatchMode('AND')}
                        >
                          AND
                        </button>
                        <button
                          type="button"
                          className={`fdrop__seg-btn ${genreMatchMode === 'OR' ? 'is-on' : ''}`}
                          onClick={() => setGenreMatchMode('OR')}
                        >
                          OR
                        </button>
                      </div>
                      <span className="fdrop__toolbar-hint mono">Click to toggle tags</span>
                    </div>
                    <div className="fdrop__scroll">
                      <div className="fdrop__search-row fdrop__search-row--inline">
                        <div className="fdrop__search-row-top">
                          <h4 className="tagpop__heading mono">Tags</h4>
                        </div>
                        <div className="fdrop__search fdrop__search--combo">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="7"></circle>
                            <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
                          </svg>
                          <input
                            placeholder="Type to add a tag, press Enter…"
                            value={genreSearch}
                            onChange={(e) => setGenreSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Phân vùng Genres và Formats */}
                      {(() => {
                        const searchLow = genreSearch.toLowerCase();
                        const filteredG = ALL_GENRES.filter((g) => g.toLowerCase().includes(searchLow));
                        const filteredF = ALL_FORMATS.filter((f) => f.toLowerCase().includes(searchLow));

                        return (
                          <>
                            {filteredG.length > 0 && (
                              <section className="tagpop__sec">
                                <h4 className="tagpop__heading mono">Genres</h4>
                                <ul className="tagpop__list">
                                  {filteredG.map((genre) => {
                                    const isSelected = selectedGenres.includes(genre);
                                    const tagClass = isSelected ? 'tagpop__item--inc' : 'tagpop__item--off';

                                    return (
                                      <li key={genre}>
                                        <button
                                          type="button"
                                          className={`tagpop__item ${tagClass}`}
                                          onClick={() => setSelectedGenres((prev) => toggleArrayItem(prev, genre))}
                                        >
                                          <span className="tagpop__check" aria-hidden="true">
                                            {isSelected && (
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                              </svg>
                                            )}
                                          </span>
                                          <span className="tagpop__name">{genre}</span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </section>
                            )}

                            {filteredF.length > 0 && (
                              <section className="tagpop__sec">
                                <h4 className="tagpop__heading mono">Formats</h4>
                                <ul className="tagpop__list">
                                  {filteredF.map((format) => {
                                    const isSelected = selectedFormats.includes(format);
                                    const tagClass = isSelected ? 'tagpop__item--on' : 'tagpop__item--off';

                                    return (
                                      <li key={format}>
                                        <button
                                          type="button"
                                          className={`tagpop__item ${tagClass}`}
                                          onClick={() => setSelectedFormats((prev) => toggleArrayItem(prev, format))}
                                        >
                                          <span className="tagpop__check" aria-hidden="true">
                                            {isSelected && (
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                              </svg>
                                            )}
                                          </span>
                                          <span className="tagpop__name">{format}</span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </section>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* DEMOGRAPHIC */}
              <div className={`fdrop ${isDemographicOpen ? 'is-open' : ''}`} ref={demographicRef}>
                <label className="fdrop__label mono">DEMOGRAPHIC</label>
                <button type="button" className="fdrop__btn" aria-haspopup="listbox" aria-expanded={isDemographicOpen} onClick={() => setIsDemographicOpen(!isDemographicOpen)}>
                  <span className="fdrop__value">{getDisplayValue(selectedDemographics)}</span>
                  <svg className="fdrop__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isDemographicOpen && (
                  <div className="fdrop__pop fdrop__pop--multi">
                    <ul className="fdrop__list" role="listbox">
                      {DEMOGRAPHIC_OPTIONS.map((demo) => {
                        const isSelected = selectedDemographics.includes(demo);
                        return (
                          <li
                            key={demo}
                            role="option"
                            aria-selected={isSelected}
                            className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                            onClick={() => setSelectedDemographics((prev) => toggleArrayItem(prev, demo))}
                          >
                            <span className={`fdrop__check fdrop__check--box ${isSelected ? 'is-checked' : ''}`} aria-hidden="true">
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </span>
                            {demo}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* RELEASE STATUS */}
              <div className={`fdrop ${isStatusOpen ? 'is-open' : ''}`} ref={statusRef}>
                <label className="fdrop__label mono">RELEASE STATUS</label>
                <button type="button" className="fdrop__btn" aria-haspopup="listbox" aria-expanded={isStatusOpen} onClick={() => setIsStatusOpen(!isStatusOpen)}>
                  <span className="fdrop__value">{getDisplayValue(selectedStatuses)}</span>
                  <svg className="fdrop__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isStatusOpen && (
                  <div className="fdrop__pop fdrop__pop--multi">
                    <ul className="fdrop__list" role="listbox">
                      {STATUS_OPTIONS.map((status) => {
                        const isSelected = selectedStatuses.includes(status);
                        return (
                          <li
                            key={status}
                            role="option"
                            aria-selected={isSelected}
                            className={`fdrop__item ${isSelected ? 'is-active' : ''}`}
                            onClick={() => setSelectedStatuses((prev) => toggleArrayItem(prev, status))}
                          >
                            <span className={`fdrop__check fdrop__check--box ${isSelected ? 'is-checked' : ''}`} aria-hidden="true">
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </span>
                            {status}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* BOTTOM SORT TAB BAR */}
        <div className="uview__sort-tabs">
          <div className="useg useg--scroll">
            <button 
              type="button" 
              className={`useg__btn ${subTab.startsWith('updated') ? 'is-on' : ''}`} 
              aria-pressed={subTab.startsWith('updated')} 
              title="Recently updated (desc)" 
              onClick={() => setSubTab('updated_desc')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14"></path>
                <path d="M19 12l-7 7-7-7"></path>
              </svg>
              <span>Recently updated</span>
            </button>
            <button 
              type="button" 
              className={`useg__btn ${subTab.startsWith('added') ? 'is-on' : ''}`} 
              aria-pressed={subTab.startsWith('added')} 
              title="Recently added" 
              onClick={() => setSubTab('added_desc')}
            >
              <span>Recently added</span>
            </button>
            <button 
              type="button" 
              className={`useg__btn ${subTab.startsWith('read') ? 'is-on' : ''}`} 
              aria-pressed={subTab.startsWith('read')} 
              title="Recently read" 
              onClick={() => setSubTab('read_desc')}
            >
              <span>Recently read</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container" style={{ padding: '20px', textAlign: 'center' }}>Loading your library...</div>
        ) : error ? (
          <div className="error-container" style={{ padding: '20px', textAlign: 'center', color: 'red' }}>Error: {error}</div>
        ) : paginatedComics.length === 0 ? (
          <div className="empty-container" style={{ padding: '40px', textAlign: 'center' }}>No titles found in your library.</div>
        ) : viewMode === 'grid' ? (
          <div className="ugrid">
            {paginatedComics.map((item) => (
              <ComicCard key={item.comic.id} comic={item.comic} onUnfollow={handleUnfollow} />
            ))}
          </div>
        ) : (
          <ul className="ulist">
            {paginatedComics.map((item) => (
              <ComicRow
                key={item.comic.id}
                comic={{
                  ...item.comic,
                  followingCategoryId: item.category?.id || null,
                  categoryName: item.category?.category || null
                }}
                onUnfollow={handleUnfollow}
                categories={folders}
                readedChapter={item.readedChapter}
                totalChapters={item.totalChapters}
                onMoveCategory={handleMoveCategory}
              />
            ))}
          </ul>
        )}

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
              <span className="upagination__current">{currentPage}</span>
              <span className="upagination__separator">/</span>
              <span className="upagination__total">{totalPages}</span>
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
      </div>
    </div>
  );
}