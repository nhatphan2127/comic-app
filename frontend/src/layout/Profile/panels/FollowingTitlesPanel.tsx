import { useState, useEffect, useRef } from 'react';
import type { UserFollowingCategory, FollowingComic } from '../../../types/data';
import Pagination from '../../../components/Pagination';
import { ComicCard, ComicRow } from '../../../components/FollowingComic';
import { comicApi, userApi } from '../../../services/api';

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

export default function FollowingTitlesPanel() {
  const [allComics, setAllComics] = useState<FollowingComic[]>([]);
  const [filteredComics, setFilteredComics] = useState<FollowingComic[]>([]);
  const [folders, setFolders] = useState<UserFollowingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode] = useState<'grid' | 'list'>('list');
  const [subTab, setSubTab] = useState<'updated' | 'added' | 'read'>('updated');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAdvancedOpen] = useState<boolean>(true);
  const [isEditFoldersOpen, setIsEditFoldersOpen] = useState<boolean>(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);

  // --- States mới cho các bộ lọc bổ sung ---
  const [isTypesOpen, setIsTypesOpen] = useState(false);
  const [isGenresOpen, setIsGenresOpen] = useState(false);
  const [isDemographicOpen, setIsDemographicOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Genres và Formats hỗ trợ 3 trạng thái: 'include' (chọn), 'exclude' (loại trừ), 'off' (không chọn)
  const [selectedGenres, setSelectedGenres] = useState<Record<string, 'include' | 'exclude'>>({});
  const [selectedFormats, setSelectedFormats] = useState<Record<string, 'include' | 'exclude'>>({});
  const [genreMatchMode, setGenreMatchMode] = useState<'AND' | 'OR'>('AND');
  const [genreSearch, setGenreSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // --- Refs mới để ẩn dropdown khi click ra ngoài ---
  const editFoldersRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const typesRef = useRef<HTMLDivElement>(null);
  const genresRef = useRef<HTMLDivElement>(null);
  const demographicRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const sortOptions = [
    { key: 'updated', label: 'Recently updated' },
    { key: 'added', label: 'Recently added' },
    { key: 'read', label: 'Recently read' },
  ];

  // Xử lý sự kiện click ngoài cho tất cả dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (editFoldersRef.current && !editFoldersRef.current.contains(target)) {
        setIsEditFoldersOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setIsSortMenuOpen(false);
      }
      if (typesRef.current && !typesRef.current.contains(target)) {
        setIsTypesOpen(false);
      }
      if (genresRef.current && !genresRef.current.contains(target)) {
        setIsGenresOpen(false);
      }
      if (demographicRef.current && !demographicRef.current.contains(target)) {
        setIsDemographicOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(target)) {
        setIsStatusOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [comics, categories] = await Promise.all([userApi.getFollowingList(), userApi.getFollowingCategories()]);
      setAllComics(comics || []);
      setFilteredComics(comics || []);
      setFolders(categories || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load your library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // --- Logic lọc và sắp xếp chính ---
  useEffect(() => {
    let result = [...allComics];
    const query = searchQuery.trim().toLowerCase();

    // 1. Lọc theo thanh tìm kiếm tên truyện
    if (query) {
      result = result.filter((item) => {
        const title = `${item.comic.name || (item.comic as any).title || ''}`.toLowerCase();
        return title.includes(query);
      });
    }

    // 2. Lọc theo thư mục (Folder)
    if (activeFolderId) {
      result = result.filter((item) => item.category?.id === activeFolderId);
    }

    // 3. Lọc theo TYPES
    if (selectedTypes.length > 0) {
      result = result.filter((item) => {
        const comicType = (item.comic.types || (item.comic as any).type || '').toLowerCase();
        return selectedTypes.some((t) => t.toLowerCase() === comicType);
      });
    }

    // 4. Lọc theo DEMOGRAPHIC
    if (selectedDemographics.length > 0) {
      result = result.filter((item) => {
        const demo = (item.comic.demographic || (item.comic as any).demographic || '').toLowerCase();
        return selectedDemographics.some((d) => d.toLowerCase() === demo);
      });
    }

    // 5. Lọc theo RELEASE STATUS
    if (selectedStatuses.length > 0) {
      result = result.filter((item) => {
        const status = (item.comic.releaseStatus || (item.comic as any).status || '').toLowerCase().replace(/\s+/g, '');
        return selectedStatuses.some((s) => {
          const targetStatus = s.toLowerCase().replace(/\s+/g, '');
          return status === targetStatus;
        });
      });
    }

    // 6. Lọc theo GENRES & FORMATS (Bao gồm logic AND / OR và Loại trừ)
    const hasGenreFilters = Object.keys(selectedGenres).length > 0 || Object.keys(selectedFormats).length > 0;
    if (hasGenreFilters) {
      const incGenres = Object.entries(selectedGenres).filter(([_, val]) => val === 'include').map(([k]) => k.toLowerCase());
      const excGenres = Object.entries(selectedGenres).filter(([_, val]) => val === 'exclude').map(([k]) => k.toLowerCase());
      const incFormats = Object.entries(selectedFormats).filter(([_, val]) => val === 'include').map(([k]) => k.toLowerCase());
      const excFormats = Object.entries(selectedFormats).filter(([_, val]) => val === 'exclude').map(([k]) => k.toLowerCase());

      result = result.filter((item) => {
        // Lấy danh sách thể loại (genres) của truyện hiện tại
        const comicGenres: string[] = Array.isArray(item.comic.genres)
          ? item.comic.genres.map((g: any) => (typeof g === 'string' ? g.toLowerCase() : (g.name || '').toLowerCase()))
          : [];

        // Lấy danh sách định dạng (formats) của truyện hiện tại (hỗ trợ formats mảng string, format mảng string hoặc format đơn lẻ)
        const rawFormats = (item.comic as any).formats || item.comic.formats || [];
        const comicFormats: string[] = Array.isArray(rawFormats)
          ? rawFormats.map((f: any) => (typeof f === 'string' ? f.toLowerCase() : (f.name || '').toLowerCase()))
          : typeof rawFormats === 'string'
          ? [rawFormats.toLowerCase()]
          : [];

        // Kiểm tra loại trừ trước (Nếu dính một thể loại/định dạng bị loại trừ thì bỏ qua ngay)
        const isExcludedGenre = comicGenres.some((g) => excGenres.includes(g));
        const isExcludedFormat = comicFormats.some((f) => excFormats.includes(f));
        if (isExcludedGenre || isExcludedFormat) return false;

        // Kiểm tra điều kiện bao gồm
        if (incGenres.length > 0 || incFormats.length > 0) {
          const matchedGenres = incGenres.filter((g) => comicGenres.includes(g));
          const matchedFormats = incFormats.filter((f) => comicFormats.includes(f));
          
          const totalMatches = matchedGenres.length + matchedFormats.length;
          const totalRequired = incGenres.length + incFormats.length;

          if (genreMatchMode === 'AND') {
            return totalMatches === totalRequired;
          } else {
            return totalMatches > 0;
          }
        }
        return true;
      });
    }

    // Sắp xếp danh sách kết quả
    const compareDates = (a?: string | null, b?: string | null) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    };

    const getSortDate = (item: FollowingComic) => {
      if (subTab === 'updated') return item.comic.updatedAt || item.updatedAt;
      if (subTab === 'added') return item.updatedAt || item.comic.updatedAt;
      if (subTab === 'read') return item.updatedAt || item.comic.updatedAt;
      return item.comic.updatedAt || item.updatedAt;
    };

    result.sort((a, b) => compareDates(getSortDate(a), getSortDate(b)) || (a.comic.name || '').localeCompare(b.comic.name || ''));
    setFilteredComics(result);
    setCurrentPage(1);
  }, [
    searchQuery,
    activeFolderId,
    allComics,
    subTab,
    selectedTypes,
    selectedDemographics,
    selectedStatuses,
    selectedGenres,
    selectedFormats,
    genreMatchMode
  ]);

  // Khôi phục tất cả bộ lọc về trạng thái ban đầu
  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveFolderId(null);
    setSubTab('updated');
    setIsSortMenuOpen(false);
    setSelectedTypes([]);
    setSelectedDemographics([]);
    setSelectedStatuses([]);
    setSelectedGenres({});
    setSelectedFormats({});
    setGenreMatchMode('AND');
    setGenreSearch('');
  };

  // --- Hàm hỗ trợ giao diện ---
  const toggleCheckbox = (item: string, state: string[], setState: React.Dispatch<React.SetStateAction<string[]>>) => {
    setState((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  };

  const toggleTag = (tag: string, isGenre: boolean) => {
    const state = isGenre ? selectedGenres : selectedFormats;
    const setState = isGenre ? setSelectedGenres : setSelectedFormats;

    setState((prev) => {
      const current = prev[tag];
      const updated = { ...prev };
      if (!current) {
        updated[tag] = 'include';
      } else if (current === 'include') {
        updated[tag] = 'exclude';
      } else {
        delete updated[tag];
      }
      return updated;
    });
  };

  const getDisplayValue = (selected: string[]) => {
    if (selected.length === 0) return 'Any';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.length} selected`;
  };

  const getGenresDisplayValue = () => {
    const incCount = Object.values(selectedGenres).filter((v) => v === 'include').length + Object.values(selectedFormats).filter((v) => v === 'include').length;
    const excCount = Object.values(selectedGenres).filter((v) => v === 'exclude').length + Object.values(selectedFormats).filter((v) => v === 'exclude').length;
    if (incCount === 0 && excCount === 0) return 'Any';
    const parts = [];
    if (incCount > 0) parts.push(`+${incCount}`);
    if (excCount > 0) parts.push(`-${excCount}`);
    return parts.join(', ');
  };

  const handleUnfollow = async (comicId: string) => {
    try {
      await comicApi.unfollow(comicId);
      const updated = allComics.filter((item) => item.comic.id !== comicId);
      setAllComics(updated);
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
      setAllComics((prev) => prev.map((item) => item.category?.id === folderId ? { ...item, category: null as any } : item));
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
          return {
            ...item,
            category: matchedFolder as any
          };
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
              <div className="fdrop" ref={sortMenuRef}>
                <label className="fdrop__label mono">SORT BY</label>
                <button type="button" className="fdrop__btn" aria-haspopup="menu" aria-expanded={isSortMenuOpen} onClick={() => setIsSortMenuOpen((prev) => !prev)}>
                  <span className="fdrop__value">{sortOptions.find((option) => option.key === subTab)?.label ?? 'Recently updated'}</span>
                  <svg className="fdrop__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isSortMenuOpen && (
                  <div className="fdrop__pop fdrop__pop--menu" role="menu">
                    {sortOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={subTab === option.key}
                        className={`fdrop__item ${subTab === option.key ? 'is-active' : ''}`}
                        onClick={() => {
                          setSubTab(option.key as 'updated' | 'added' | 'read');
                          setIsSortMenuOpen(false);
                        }}
                      >
                        <span className="fdrop__item-check" aria-hidden="true">
                          {subTab === option.key ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 12l5 5L20 6"></path>
                            </svg>
                          ) : null}
                        </span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
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
                            onClick={() => toggleCheckbox(type, selectedTypes, setSelectedTypes)}
                          >
                            <span className={`fdrop__check fdrop__check--box ${isSelected ? 'is-checked' : ''}`} aria-hidden="true"></span>
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
                  <span className="fdrop__value">{getGenresDisplayValue()}</span>
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
                      <span className="fdrop__toolbar-hint mono">Click to include · again to exclude</span>
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
                                    const state = selectedGenres[genre];
                                    let tagClass = 'tagpop__item--off';
                                    if (state === 'include') tagClass = 'tagpop__item--on';
                                    if (state === 'exclude') tagClass = 'tagpop__item--exclude';

                                    return (
                                      <li key={genre}>
                                        <button
                                          type="button"
                                          className={`tagpop__item ${tagClass}`}
                                          onClick={() => toggleTag(genre, true)}
                                        >
                                          <span className="tagpop__check" aria-hidden="true"></span>
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
                                    const state = selectedFormats[format];
                                    let tagClass = 'tagpop__item--off';
                                    if (state === 'include') tagClass = 'tagpop__item--on';
                                    if (state === 'exclude') tagClass = 'tagpop__item--exclude';

                                    return (
                                      <li key={format}>
                                        <button
                                          type="button"
                                          className={`tagpop__item ${tagClass}`}
                                          onClick={() => toggleTag(format, false)}
                                        >
                                          <span className="tagpop__check" aria-hidden="true"></span>
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
                            onClick={() => toggleCheckbox(demo, selectedDemographics, setSelectedDemographics)}
                          >
                            <span className={`fdrop__check fdrop__check--box ${isSelected ? 'is-checked' : ''}`} aria-hidden="true"></span>
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
                            onClick={() => toggleCheckbox(status, selectedStatuses, setSelectedStatuses)}
                          >
                            <span className={`fdrop__check fdrop__check--box ${isSelected ? 'is-checked' : ''}`} aria-hidden="true"></span>
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

        <div className="uview__sort-tabs">
          <div className="useg useg--scroll">
            <button type="button" className={`useg__btn ${subTab === 'updated' ? 'is-on' : ''}`} aria-pressed={subTab === 'updated'} title="Recently updated (desc)" onClick={() => setSubTab('updated')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14"></path>
                <path d="M19 12l-7 7-7-7"></path>
              </svg>
              <span>Recently updated</span>
            </button>
            <button type="button" className={`useg__btn ${subTab === 'added' ? 'is-on' : ''}`} aria-pressed={subTab === 'added'} title="Recently added" onClick={() => setSubTab('added')}>
              <span>Recently added</span>
            </button>
            <button type="button" className={`useg__btn ${subTab === 'read' ? 'is-on' : ''}`} aria-pressed={subTab === 'read'} title="Recently read" onClick={() => setSubTab('read')}>
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
                onMoveCategory={handleMoveCategory}
              />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="pagination-wrapper" style={{ marginTop: '20px' }}>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(page) => setCurrentPage(page)} />
          </div>
        )}
      </div>
    </div>
  );
}