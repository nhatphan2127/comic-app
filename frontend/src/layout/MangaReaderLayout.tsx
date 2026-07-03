// src/components/MangaReaderLayout.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { comicApi, chapterApi, API_UPLOADS } from '../services/api';

import CommentsSection from '../components/CommentsSection';
import type { Comic } from '../types/data';
import '../assets/styles/MangaReader.css';

export default function MangaReaderLayout() {
  const { comicUrl, chapterId } = useParams<{ comicUrl: string; chapterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [comic, setComic] = useState<Comic | null>(null);
  const [chapterDetails, setChapterDetails] = useState<any | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(50); // Mặc định 50% theo HTML mẫu
  const [readMode, setReadMode] = useState<'scroll' | 'page'>('scroll');
  const lastScrollPositionRef = useRef<number>(0);
  const currentPageRef = useRef<number>(1);
  const saveHistoryTimeoutRef = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showHelpKeys, setShowHelpKeys] = useState<boolean>(false);

  // Biến đánh dấu để chỉ tự động cuộn tới trang đang đọc dở khi vừa mới load truyện xong
  const isInitialMountRef = useRef<boolean>(true);

  // Dialog hoạt động: 'settings' | 'chapters' | 'comments' | null
  const [activeDialog, setActiveDialog] = useState<'settings' | 'chapters' | 'comments' | null>(null);

  // Trạng thái cài đặt từ HTML mẫu
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl' | 'ttb'>('ttb');
  const [stripMargin, setStripMargin] = useState<number>(0); // Khung lề lề dọc (0-8)
  const [scrollMode, setScrollMode] = useState<'fast' | 'smooth'>('fast');
  const [progressBarPosition, setProgressBarPosition] = useState<'left' | 'top' | 'bottom' | 'right' | 'off'>('left');
  const [preloadImages, setPreloadImages] = useState<'some' | 'all'>('some');
  const [greyscale, setGreyscale] = useState<boolean>(false);
  const [dimAmount, setDimAmount] = useState<number>(0); // Độ tối (0% - 100%)

  // Trạng thái danh sách chương
  const [chapterSearchQuery, setChapterSearchQuery] = useState<string>('');
  const [chapterSort, setChapterSort] = useState<'newest' | 'oldest'>('newest');
  const [lockGroup, setLockGroup] = useState<boolean>(true);
  const [chapterPage, setChapterPage] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Đổi hướng đọc dựa trên readingDirection
  useEffect(() => {
    if (readingDirection === 'ttb') {
      setReadMode('scroll');
    } else {
      setReadMode('page');
    }
  }, [readingDirection]);

  const saveReadingProgress = useCallback(async (chapterToSave: string, page: number, scrollPosition: number) => {
    if (!chapterToSave) return;
    try {
      await chapterApi.saveReadingHistory(chapterToSave, page, scrollPosition);
    } catch (err) {
      console.debug('Unable to save reading history', err);
    }
  }, []);

  // Hàm cuộn trang chủ động khi click (Tránh xung đột với cuộn tự nhiên)
  const scrollToPage = useCallback((pageNum: number, smooth = true) => {
    setCurrentPage(pageNum);
    currentPageRef.current = pageNum;
    const pageElement = document.querySelector<HTMLElement>(`.rpage-page[data-page="${pageNum}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({
        behavior: smooth ? 'smooth' : 'instant',
        block: 'start'
      });
    }
  }, []);

  // Hàm chuyển chương và cập nhật thanh địa chỉ URL
  const changeChapter = useCallback((newChapterId: string) => {
    if (!newChapterId) return;
    if (chapterId && chapterId !== newChapterId) {
      saveReadingProgress(chapterId, currentPage, lastScrollPositionRef.current || 0);
    }

    if (chapterId) {
      const segments = location.pathname.split('/');
      const index = segments.lastIndexOf(chapterId);
      if (index !== -1) {
        segments[index] = newChapterId;
        navigate(segments.join('/'));
        return;
      }
    }
    navigate(`${location.pathname}/${newChapterId}`);
  }, [chapterId, currentPage, location.pathname, navigate, saveReadingProgress]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (!chapterId) return;

    const intervalId = window.setInterval(() => {
      saveReadingProgress(chapterId, currentPageRef.current, lastScrollPositionRef.current || 0);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [chapterId, saveReadingProgress]);

  // Lấy dữ liệu truyện qua API service
  useEffect(() => {
    if (!comicUrl) return;

    const fetchComic = async () => {
      try {
        const data = await comicApi.getByUrl(comicUrl);
        if (data) {
          setComic(data);
        }
      } catch (err) {
        setComic(null);
        console.error("Lỗi khi lấy thông tin truyện:", err);
      }
    };

    fetchComic();
  }, [comicUrl]);

  // Lấy chi tiết chương hiện tại qua API service
  useEffect(() => {
    if (!chapterId) return;

    const fetchChapterData = async () => {
      setLoading(true);
      setError(null);
      isInitialMountRef.current = true; // Đánh dấu bắt đầu load chương mới
      try {
        const data = await chapterApi.getDetails(chapterId);
        setChapterDetails(data);

        if (data.images && Array.isArray(data.images)) {
          const resolvedUrls = data.images.map((img: any) => `${API_UPLOADS}${img.urlPath}`);
          setImages(resolvedUrls);
        } else {
          setImages([]);
        }

        const startingPage = data.readHistory?.currentPage ? Number(data.readHistory.currentPage) : 1;
        setCurrentPage(startingPage);
        lastScrollPositionRef.current = data.readHistory?.scrollPosition ? Number(data.readHistory.scrollPosition) : 0;
      } catch (err: any) {
        setError(err.message || 'Lỗi tải trang truyện.');
      } finally {
        setLoading(false);
      }
    };

    fetchChapterData();
  }, [chapterId]);

  const comicChapters = comic?.chapters;

  const currentChapterIndex = useMemo(() => {
    if (!comicChapters || !chapterId) return -1;
    return comicChapters.findIndex(ch => ch.id === chapterId);
  }, [comicChapters, chapterId]);

  const hasPrevChapter = currentChapterIndex > 0;
  const hasNextChapter = comicChapters ? (currentChapterIndex !== -1 && currentChapterIndex < comicChapters.length - 1) : false;

  const prevChapterId = hasPrevChapter && comicChapters ? comicChapters[currentChapterIndex - 1].id : null;
  const nextChapterId = hasNextChapter && comicChapters ? comicChapters[currentChapterIndex + 1].id : null;

  const chapterNo = chapterDetails?.chapterNumber ?? (currentChapterIndex !== -1 && comicChapters ? comicChapters[currentChapterIndex].chapterNumber : 1);

  const totalPages = images.length || 1;
  const currentImage = images[currentPage - 1] || '';

  const handlePrevPage = () => {
    if (currentPage > 1) {
      if (readMode === 'page') {
        window.scrollTo({ top: 0, behavior: 'instant' });
        setCurrentPage(prev => prev - 1);
      } else {
        scrollToPage(currentPage - 1);
      }
    } else if (hasPrevChapter && prevChapterId) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      changeChapter(prevChapterId);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      if (readMode === 'page') {
        window.scrollTo({ top: 0, behavior: 'instant' });
        setCurrentPage(prev => prev + 1);
      } else {
        scrollToPage(currentPage + 1);
      }
    } else if (hasNextChapter && nextChapterId) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      changeChapter(nextChapterId);
    }
  };

  // Lắng nghe sự kiện bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
          if (readingDirection === 'rtl') {
            handleNextPage();
          } else {
            handlePrevPage();
          }
          break;
        case 'arrowright':
        case 'd':
          if (readingDirection === 'rtl') {
            handlePrevPage();
          } else {
            handleNextPage();
          }
          break;
        case 'b':
        case '[':
          if (hasPrevChapter && prevChapterId) {
            changeChapter(prevChapterId);
          }
          break;
        case 'n':
        case ']':
          if (hasNextChapter && nextChapterId) {
            changeChapter(nextChapterId);
          }
          break;
        case 'h':
        case '?':
          setShowHelpKeys(prev => !prev);
          break;
        case 'x':
          setShowControls(prev => !prev);
          break;
        case 'm':
        case 'c':
          setActiveDialog(prev => prev === 'comments' ? null : 'comments');
          break;
        case 'escape':
          setShowHelpKeys(false);
          setActiveDialog(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, hasPrevChapter, hasNextChapter, prevChapterId, nextChapterId, readMode, readingDirection, changeChapter]);

  // Chỉ thực hiện tự động cuộn ở lần đầu tiên load chương truyện
  useEffect(() => {
    if (loading || error || images.length === 0 || !isInitialMountRef.current) {
      return;
    }

    const pageElement = document.querySelector<HTMLElement>(`.rpage-page[data-page="${currentPage}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
      isInitialMountRef.current = false; // Tắt cờ sau khi đã định vị xong
    }
  }, [currentPage, loading, error, images.length]);

  // Đồng bộ lịch sử đọc sách khi trang thay đổi (debounce)
  useEffect(() => {
    const saveHistory = async () => {
      if (!chapterId) return;
      try {
        await chapterApi.saveReadingHistory(chapterId, currentPage, lastScrollPositionRef.current || 0);
      } catch (err) {
        console.debug('Unable to save reading history', err);
      }
    };

    if (saveHistoryTimeoutRef.current) {
      window.clearTimeout(saveHistoryTimeoutRef.current);
    }
    saveHistoryTimeoutRef.current = window.setTimeout(saveHistory, 600);

    return () => {
      if (saveHistoryTimeoutRef.current) {
        window.clearTimeout(saveHistoryTimeoutRef.current);
      }
    };
  }, [chapterId, currentPage]);

  // SỬ DỤNG INTERSECTION OBSERVER ĐỂ THEO DÕI ẢNH ĐANG ĐỌC (TỐI ƯU NHẤT)
  useEffect(() => {
    if (loading || error || images.length === 0 || readMode !== 'scroll') {
      return;
    }

    const observerOptions = {
      root: null, // theo dõi khung hình viewport của trình duyệt
      rootMargin: '-25% 0px -40% 0px', // Khoanh vùng tiêu điểm ở phần giữa màn hình
      threshold: 0.1,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // Tìm các ảnh đang thực sự hiển thị trong vùng tiêu điểm
      const visibleEntries = entries.filter(entry => entry.isIntersecting);
      if (visibleEntries.length === 0) return;

      // Tìm ảnh gần phía trên cùng nhất của màn hình nhất
      let bestEntry = visibleEntries[0];
      let minTop = Math.abs(bestEntry.boundingClientRect.top);

      for (let i = 1; i < visibleEntries.length; i++) {
        const entry = visibleEntries[i];
        const topDist = Math.abs(entry.boundingClientRect.top);
        if (topDist < minTop) {
          minTop = topDist;
          bestEntry = entry;
        }
      }

      const pageNumAttr = bestEntry.target.getAttribute('data-page');
      if (pageNumAttr) {
        const detectedPage = parseInt(pageNumAttr, 10);
        if (detectedPage !== currentPageRef.current) {
          currentPageRef.current = detectedPage;
          setCurrentPage(detectedPage);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const pageElements = document.querySelectorAll('.rpage-page');
    pageElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [images, loading, error, readMode]);

  // THEO DÕI VỊ TRÍ CUỘN ĐỂ LƯU LẠI TIẾN TRÌNH (Tối giản hoàn toàn tính toán nặng)
  useEffect(() => {
    const handleScroll = () => {
      const container = mainRef.current?.querySelector('.rpage-main__inner') as HTMLElement | null || mainRef.current;
      const scrollY = container ? container.scrollTop : window.scrollY;
      lastScrollPositionRef.current = scrollY;

      if (saveHistoryTimeoutRef.current) {
        window.clearTimeout(saveHistoryTimeoutRef.current);
      }
      saveHistoryTimeoutRef.current = window.setTimeout(async () => {
        if (!chapterId) return;
        try {
          await chapterApi.saveReadingHistory(chapterId, currentPageRef.current, lastScrollPositionRef.current);
        } catch (err) {
          console.debug('Unable to save reading history on scroll', err);
        }
      }, 800);
    };

    const container = mainRef.current?.querySelector('.rpage-main__inner') as HTMLElement | null || mainRef.current;
    const target: any = container || window;

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      try {
        target.removeEventListener('scroll', handleScroll);
      } catch (e) {}
      if (saveHistoryTimeoutRef.current) {
        window.clearTimeout(saveHistoryTimeoutRef.current);
      }
    };
  }, [chapterId]); // Bỏ currentPage ra khỏi dependency để ko render lại listener vô ích

  // Bộ lọc và phân trang danh sách chương
  const CHAPTERS_PER_PAGE = 10;
  const filteredChapters = useMemo(() => {
    let list = comicChapters ? [...comicChapters] : [];
    if (chapterSearchQuery.trim()) {
      list = list.filter(ch =>
        ch.chapterNumber.toString().includes(chapterSearchQuery) ||
        ch.title?.toLowerCase().includes(chapterSearchQuery.toLowerCase())
      );
    }
    if (chapterSort === 'oldest') {
      list.reverse();
    }
    return list;
  }, [comicChapters, chapterSearchQuery, chapterSort]);

  const totalChapterPages = Math.ceil(filteredChapters.length / CHAPTERS_PER_PAGE) || 1;
  const paginatedChapters = useMemo(() => {
    const start = (chapterPage - 1) * CHAPTERS_PER_PAGE;
    return filteredChapters.slice(start, start + CHAPTERS_PER_PAGE);
  }, [filteredChapters, chapterPage]);

  return (
    <div
      className={`rpage ${readMode === 'scroll' ? 'rpage--long-strip rpage--ttb' : 'rpage--single-page'} rpage--pb-${progressBarPosition}`}
      style={{
        '--rpage-dim': (100 - dimAmount) / 100,
        '--rpage-strip-gap': `${stripMargin}rem`,
        filter: greyscale ? 'grayscale(100%)' : 'none'
      } as React.CSSProperties}
    >
      {/* 1. Thanh tiến trình */}
      {progressBarPosition !== 'off' && (
        <div className={`rpage-progress rpage-progress--${progressBarPosition}`} aria-label="Page progress">
          {images.map((_, index) => {
            const pageNum = index + 1;
            const isVisited = pageNum <= currentPage; // Tô tím tất cả các trang nhỏ hơn hoặc bằng trang hiện tại
            const isActive = pageNum === currentPage;
            return (
              <button
                key={index}
                type="button"
                className={`rpage-progress__seg ${isVisited ? 'is-visited' : ''} ${isActive ? 'is-active' : ''}`}
                title={`Page ${pageNum}`}
                aria-label={`Go to page ${pageNum}`}
                onClick={() => scrollToPage(pageNum)} // Cuộn mượt khi click chủ động
              />
            );
          })}
        </div>
      )}

      <div className="rpage-hoverzone rpage-hoverzone--top" aria-hidden="true" onClick={handlePrevPage}></div>
      <div className="rpage-hoverzone rpage-hoverzone--bottom" aria-hidden="true" onClick={handleNextPage}></div>
      <div className="rpage-hoverzone rpage-hoverzone--right" aria-hidden="true" onClick={() => setShowControls(!showControls)}></div>

      {/* 2. Hộp điều khiển chính (Float Control Toolbar) */}
      {showControls && (
        <div className="rpage-floatctl" role="toolbar" aria-label="Reader controls">

          <div className="rpage-floatctl__col">
            <a href="/" className="rpage-floatctl__btn" aria-label="Home" title="Home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l9-8 9 8"></path>
                <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"></path>
              </svg>
            </a>
            <a href={`/comics/${comicUrl}`} className="rpage-floatctl__btn" aria-label="Manga page" title="Manga page">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5a1 1 0 0 1 1-1h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3a1 1 0 0 1-1-1V5z"></path>
                <path d="M22 5a1 1 0 0 0-1-1h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6a1 1 0 0 0 1-1V5z"></path>
              </svg>
            </a>
            <button
              type="button"
              className={`rpage-floatctl__btn ${activeDialog === 'comments' ? 'is-active' : ''}`}
              aria-label="Toggle comments"
              title="Comments (M)"
              onClick={() => setActiveDialog(activeDialog === 'comments' ? null : 'comments')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9z"></path>
              </svg>
            </button>
            <button
              type="button"
              className="rpage-floatctl__btn"
              aria-label="Chapter list"
              title="Chapter list"
              onClick={() => setActiveDialog(activeDialog === 'chapters' ? null : 'chapters')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <circle cx="4" cy="6" r="1"></circle>
                <circle cx="4" cy="12" r="1"></circle>
                <circle cx="4" cy="18" r="1"></circle>
              </svg>
            </button>
            <button
              type="button"
              className="rpage-floatctl__btn"
              aria-label="Settings"
              title="Settings"
              onClick={() => setActiveDialog(activeDialog === 'settings' ? null : 'settings')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>
              </svg>
            </button>
            <button
              type="button"
              className="rpage-floatctl__btn"
              aria-label="Help"
              title="Help (?)"
              onClick={() => setShowHelpKeys(!showHelpKeys)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.8.8-1.8 1.3-1.8 2.3"></path>
                <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"></circle>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 3. Nội dung trang ảnh chính */}
      <main ref={mainRef} className={`rpage-main ${readMode === 'scroll' ? 'rpage-main--long-strip' : 'rpage-main--page'}`}>
        <div className="rpage-main__inner">
          {loading && (
            <div className="rpage-page is-loading" style={{ aspectRatio: "900 / 1673", width: '100%' }}>
              <div className="rpage-page__loader" aria-hidden="true">
                <div className="rpage-page__loader-inner">
                  <span className="rpage-page__spinner"></span>
                  <span className="rpage-page__counter mono">Loading...</span>
                </div>
              </div>
            </div>
          )}
          {error && <div className="error-msg">{error}</div>}

          {!loading && !error && (
            <>
              {readMode === 'page' ? (
                <div className="rpage-page" data-page={currentPage} style={{ width: `${zoomLevel}%`, margin: '0 auto' }}>
                  {currentImage && (
                    <img
                      className="rpage-page__img"
                      src={currentImage}
                      alt={`Page ${currentPage}`}
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              ) : (
                images.map((img, idx) => (
                  <div key={idx} className="rpage-page" data-page={idx + 1} style={{ width: `${zoomLevel}%`, margin: '0 auto' }}>
                    <img
                      className="rpage-page__img"
                      src={img}
                      alt={`Page ${idx + 1}`}
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))
              )}
            </>
          )}

          {/* Khối kết thúc chương (Điều hướng + Thích + Chia sẻ) */}
          {!loading && !error && (
            <div className="rpage-chap-ending">
              <div className="rpage-chap-ending__head">
                <button type="button" className="rpage-chap-ending__like" aria-pressed="false" title="Like">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 21V11"></path>
                    <path d="M7 11l4-7a2 2 0 0 1 4 1l-1 5h5a2 2 0 0 1 2 2.4l-1.5 7A2 2 0 0 1 17.5 21H7z"></path>
                  </svg>
                  <span className="rpage-chap-ending__like-count mono">11</span>
                </button>
                <div className="rpage-chap-ending__info">
                  <a className="rpage-chap-ending__title" href={`/title/${comicUrl}`}>{comic?.name || 'Untitled'}</a>
                  <div className="rpage-chap-ending__meta mono">
                    <span>Ch. {chapterNo}</span>
                    <span className="rpage-chap-ending__sep" aria-hidden="true">·</span>
                    <span>Translated by <strong>Drake Scans</strong></span>
                  </div>
                </div>
              </div>

              <div className="rpage-chap-ending__nav">
                <button
                  type="button"
                  className="rpage-chap-ending__nav-btn"
                  disabled={!hasPrevChapter}
                  onClick={() => hasPrevChapter && prevChapterId && changeChapter(prevChapterId)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  <span>Prev · Ch. <span className="mono">{hasPrevChapter && comicChapters ? comicChapters[currentChapterIndex - 1].chapterNumber : ''}</span></span>
                </button>
                <button
                  type="button"
                  className="rpage-chap-ending__nav-btn"
                  disabled={!hasNextChapter}
                  onClick={() => hasNextChapter && nextChapterId && changeChapter(nextChapterId)}
                >
                  <span>Next · Ch. <span className="mono">{hasNextChapter && comicChapters ? comicChapters[currentChapterIndex + 1].chapterNumber : ''}</span></span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>

              {chapterDetails?.id && (
                <CommentsSection targetId={chapterDetails.id} type="chapter" />
              )}
            </div>
          )}

        </div>
        
      </main>

      {/* 4. Thanh điều khiển kích thước dưới chân trang */}
      {showControls && (
        <footer className="rpage-bottombar">
          <div className="rpage-bottombar__controls">
            <div className="rpage-zoom rpage-bottombar__hide-mobile" role="group" aria-label="Image width">
              <button
                type="button"
                className="rpage-zoom__btn"
                aria-label="Shrink image"
                title="Shrink image"
                onClick={() => setZoomLevel(z => Math.max(z - 10, 30))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                </svg>
              </button>
              <span className="rpage-zoom__value mono" aria-live="polite">{zoomLevel}%</span>
              <button
                type="button"
                className="rpage-zoom__btn"
                aria-label="Enlarge image"
                title="Enlarge image"
                onClick={() => setZoomLevel(z => Math.min(z + 10, 100))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* 5. HỘP THOẠI CÀI ĐẶT */}
      {activeDialog === 'settings' && (
        <div className="minidlg rpage-modal rpage-modal--settings" role="dialog" aria-label="Reader settings">
          <div className="minidlg__panel rpage-modal__panel rpage-modal__panel--settings">
            <div className="rpage-settings is-open" aria-hidden="false">
              <div className="rpage-settings__panel" role="dialog" aria-label="Reader settings">
                <header className="rpage-modal__head">
                  <h3 className="rpage-modal__title">Settings</h3>
                  <button type="button" className="rpage-modal__close" aria-label="Close settings" onClick={() => setActiveDialog(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 6l12 12M18 6l-12 12"></path>
                    </svg>
                  </button>
                </header>
                <div className="rpage-settings__body">

                  {/* Hướng đọc */}
                  <section className="rpage-settings__group">
                    <h3 className="rpage-settings__title mono">Reading direction</h3>
                    <div className="rpage-dir2" role="radiogroup" aria-label="Reading direction">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={readingDirection === 'ltr'}
                        className={`rpage-dir2__btn ${readingDirection === 'ltr' ? 'is-on' : ''}`}
                        onClick={() => setReadingDirection('ltr')}
                      >
                        <span className="rpage-dir2__arrow" aria-hidden="true">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h12"></path><path d="M13 7l5 5-5 5"></path><path d="M21 5v14"></path>
                          </svg>
                        </span>
                        <span>Left to right</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={readingDirection === 'rtl'}
                        className={`rpage-dir2__btn ${readingDirection === 'rtl' ? 'is-on' : ''}`}
                        onClick={() => setReadingDirection('rtl')}
                      >
                        <span className="rpage-dir2__arrow" aria-hidden="true">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 5v14"></path><path d="M19 12H7"></path><path d="M11 7l-5 5 5 5"></path>
                          </svg>
                        </span>
                        <span>Right to left</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={readingDirection === 'ttb'}
                        className={`rpage-dir2__btn ${readingDirection === 'ttb' ? 'is-on' : ''}`}
                        onClick={() => setReadingDirection('ttb')}
                      >
                        <span className="rpage-dir2__arrow" aria-hidden="true">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 21h14"></path><path d="M12 17V5"></path><path d="M7 13l5 5 5-5"></path>
                          </svg>
                        </span>
                        <span>Top to bottom</span>
                      </button>
                    </div>
                  </section>

                  {/* Khoảng cách viền */}
                  <section className="rpage-settings__group">
                    <h3 className="rpage-settings__title mono">Strip margin</h3>
                    <div className="rpage-numinput">
                      <div className="rpage-numinput__group">
                        <button
                          type="button"
                          className="rpage-numinput__btn"
                          disabled={stripMargin <= 0}
                          onClick={() => setStripMargin(m => Math.max(0, m - 1))}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14"></path>
                          </svg>
                        </button>
                        <input className="rpage-numinput__field" min="0" max="8" step="1" aria-label="Strip margin" type="number" value={stripMargin} readOnly />
                        <button
                          type="button"
                          className="rpage-numinput__btn"
                          disabled={stripMargin >= 8}
                          onClick={() => setStripMargin(m => Math.min(8, m + 1))}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14"></path>
                          </svg>
                        </button>
                      </div>
                      <button type="button" className="rpage-numinput__reset" disabled={stripMargin === 0} onClick={() => setStripMargin(0)}>Reset</button>
                    </div>
                  </section>

                  {/* Trượt bàn phím */}
                  <section className="rpage-settings__group rpage-settings__group--desktop-only">
                    <h3 className="rpage-settings__title mono">Keyboard scrolling</h3>
                    <div className="rpage-settings__opts">
                      <label className={`rpage-opt ${scrollMode === 'fast' ? 'is-on' : ''}`}>
                        <input type="radio" value="fast" checked={scrollMode === 'fast'} onChange={() => setScrollMode('fast')} name="scrollMode" />
                        <span className="rpage-opt__dot" aria-hidden="true"></span>
                        <span>Scroll fast</span>
                      </label>
                      <label className={`rpage-opt ${scrollMode === 'smooth' ? 'is-on' : ''}`}>
                        <input type="radio" value="smooth" checked={scrollMode === 'smooth'} onChange={() => setScrollMode('smooth')} name="scrollMode" />
                        <span className="rpage-opt__dot" aria-hidden="true"></span>
                        <span>Scroll smooth</span>
                      </label>
                    </div>
                    <p className="rpage-settings__hint">Step size for Arrow / Space / W / S keys, as percent of the viewport height.</p>
                  </section>

                  {/* Vị trí thanh tiến trình */}
                  <section className="rpage-settings__group">
                    <h3 className="rpage-settings__title mono">Progress bar</h3>
                    <div className="rpage-pb" role="radiogroup" aria-label="Progress bar position">
                      {(['left', 'top', 'bottom', 'right', 'off'] as const).map((pos) => {
                        const isActive = progressBarPosition === pos;
                        return (
                          <button
                            key={pos}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            title={`Progress bar ${pos}`}
                            aria-label={`Progress bar ${pos}`}
                            className={`rpage-pb__btn ${isActive ? 'is-on' : ''}`}
                            onClick={() => setProgressBarPosition(pos)}
                          >
                            {pos === 'left' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14"></path><path d="M19 12H7"></path><path d="M11 7l-5 5 5 5"></path></svg>}
                            {pos === 'top' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14"></path><path d="M12 7v12"></path><path d="M7 11l5-5 5 5"></path></svg>}
                            {pos === 'bottom' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21h14"></path><path d="M12 17V5"></path><path d="M7 13l5 5 5-5"></path></svg>}
                            {pos === 'right' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h12"></path><path d="M13 7l5 5-5 5"></path><path d="M21 5v14"></path></svg>}
                            {pos === 'off' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"></circle><line x1="6.5" y1="6.5" x2="17.5" y2="17.5"></line></svg>}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Tải trước ảnh */}
                  <section className="rpage-settings__group">
                    <h3 className="rpage-settings__title mono">Preload images</h3>
                    <div className="rpage-settings__opts">
                      <label className={`rpage-opt ${preloadImages === 'some' ? 'is-on' : ''}`}>
                        <input type="radio" value="some" checked={preloadImages === 'some'} onChange={() => setPreloadImages('some')} name="preload" />
                        <span className="rpage-opt__dot" aria-hidden="true"></span>
                        <span>Preload some</span>
                      </label>
                      <label className={`rpage-opt ${preloadImages === 'all' ? 'is-on' : ''}`}>
                        <input type="radio" value="all" checked={preloadImages === 'all'} onChange={() => setPreloadImages('all')} name="preload" />
                        <span className="rpage-opt__dot" aria-hidden="true"></span>
                        <span>Preload all</span>
                      </label>
                    </div>
                  </section>

                  {/* Đen trắng */}
                  <section className="rpage-settings__group">
                    <div className="rpage-settings__opts">
                      <label className={`rpage-opt rpage-opt--toggle ${greyscale ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={greyscale} onChange={(e) => setGreyscale(e.target.checked)} />
                        <span className="rpage-opt__check" aria-hidden="true"></span>
                        <span>Greyscale pages</span>
                      </label>
                    </div>
                  </section>

                  {/* Giảm độ sáng trang */}
                  <section className="rpage-settings__group">
                    <h3 className="rpage-settings__title mono">Dim pages</h3>
                    <div className="rpage-slider">
                      <div className="rpage-slider__row">
                        <input min="0" max="100" step="1" aria-label="Dim amount" type="range" value={dimAmount} onChange={(e) => setDimAmount(parseInt(e.target.value) || 0)} />
                        <span className="rpage-slider__val mono">{dimAmount}%</span>
                      </div>
                    </div>
                  </section>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. HỘP THOẠI DANH SÁCH CHƯƠNG */}
      {activeDialog === 'chapters' && (
        <div className="minidlg rpage-modal rpage-modal--chaplist" role="dialog" aria-label="Chapter list">
          <div className="minidlg__panel rpage-modal__panel rpage-modal__panel--chaplist">
            <header className="rpage-modal__head">
              <h3 className="rpage-modal__title">Chapters</h3>
              <button type="button" className="rpage-modal__close" aria-label="Close" onClick={() => setActiveDialog(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6l-12 12"></path>
                </svg>
              </button>
            </header>
            <div className="rpage-chaplist__toolbar">
              <div className="rpage-chaplist__search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"></circle>
                  <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
                </svg>
                <input
                  inputMode="numeric"
                  aria-label="Search chapter"
                  type="text"
                  value={chapterSearchQuery}
                  onChange={(e) => {
                    setChapterSearchQuery(e.target.value);
                    setChapterPage(1);
                  }}
                />
              </div>
              <button
                type="button"
                className="rpage-chaplist__sort"
                aria-label="Sort descending"
                title={chapterSort === 'newest' ? "Sort: Newest first" : "Sort: Oldest first"}
                onClick={() => setChapterSort(s => s === 'newest' ? 'oldest' : 'newest')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5h4"></path><path d="M11 9h7"></path><path d="M11 13h10"></path>
                  <path d="M3 7l3-3 3 3"></path><path d="M6 20V4"></path>
                </svg>
              </button>
            </div>

            <label className={`rpage-chaplist__lock ${lockGroup ? 'is-on' : ''}`}>
              <input type="checkbox" checked={lockGroup} onChange={(e) => setLockGroup(e.target.checked)} />
              <span className="rpage-chaplist__lock-box" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              <span>Lock to this group when prev, next chap</span>
            </label>

            <div className="rpage-chaplist__body">
              <ul className="rpage-chaplist__list">
                {paginatedChapters.map((ch) => {
                  const isActive = ch.id === chapterId;
                  return (
                    <li key={ch.id}>
                      <button
                        type="button"
                        className={`rpage-chaplist__item ${isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          changeChapter(ch.id);
                          setActiveDialog(null);
                        }}
                      >
                        <div className="rpage-chaplist__line1">
                          <span className="rpage-chaplist__num">Ch.{ch.chapterNumber}</span>
                        </div>
                        <div className="rpage-chaplist__line2">
                          <span className="rpage-chaplist__group">{ch.title || 'Drake Scans'}</span>
                          <span className="rpage-chaplist__sep">·</span>
                          <span className="rpage-chaplist__time">2w ago</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Phân trang danh sách chương */}
            <footer className="rpage-chaplist__foot">
              <nav className="npager" aria-label="Pagination">
                {Array.from({ length: totalChapterPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`npager__num ${chapterPage === p ? 'is-active' : ''}`}
                    aria-current={chapterPage === p ? 'page' : undefined}
                    onClick={() => setChapterPage(p)}
                  >
                    {p}
                  </button>
                ))}
              </nav>
            </footer>
          </div>
        </div>
      )}

      {/* 7. HỘP THOẠI HƯỚNG DẪN PHÍM TẮT */}
      {showHelpKeys && (
        <div className="minidlg rpage-modal rpage-modal--help" role="dialog" aria-label="Keyboard shortcuts">
          <div className="minidlg__panel rpage-modal__panel rpage-modal__panel--help">
            <header className="rpage-modal__head">
              <h3 className="rpage-modal__title">Keyboard shortcuts</h3>
              <button type="button" className="rpage-modal__close" aria-label="Close" onClick={() => setShowHelpKeys(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6l-12 12"></path>
                </svg>
              </button>
            </header>
            <div className="rpage-help__body">
              <ul className="rpage-keys">
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Scroll page (vertical)</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">↑</kbd>
                    <kbd className="rpage-keys__key">↓</kbd>
                    <kbd className="rpage-keys__key">W</kbd>
                    <kbd className="rpage-keys__key">S</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Change page (horizontal)</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">←</kbd>
                    <kbd className="rpage-keys__key">→</kbd>
                    <kbd className="rpage-keys__key">A</kbd>
                    <kbd className="rpage-keys__key">D</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Previous chapter</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">B</kbd>
                    <kbd className="rpage-keys__key">[</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Next chapter</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">N</kbd>
                    <kbd className="rpage-keys__key">]</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Comments panel</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">M</kbd>
                    <kbd className="rpage-keys__key">C</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Fullscreen</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">F</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Show / hide controls</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">double tap</kbd>
                    <kbd className="rpage-keys__key">X</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">This help</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">H</kbd>
                    <kbd className="rpage-keys__key">?</kbd>
                  </span>
                </li>
                <li className="rpage-keys__row">
                  <span className="rpage-keys__desc">Close dialog</span>
                  <span className="rpage-keys__chips">
                    <kbd className="rpage-keys__key">Esc</kbd>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 8. PANEL BÊN TRỰC QUAN CHO BÌNH LUẬN */}
      <aside className={`rpage-cmpanel ${activeDialog === 'comments' ? 'is-open' : ''}`} aria-hidden={activeDialog !== 'comments'}>
        <div className="rpage-cmpanel__chapnav">
          <button type="button" className="rpage-cmpanel__like" title="Like chapter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 21V11"></path>
              <path d="M7 11l4-7a2 2 0 0 1 4 1l-1 5h5a2 2 0 0 1 2 2.4l-1.5 7A2 2 0 0 1 17.5 21H7z"></path>
            </svg>
            <span className="mono">11</span>
          </button>
          <span className="rpage-cmpanel__like-attribution">Translated by <strong>Drake Scans</strong></span>

          <div className="rpage-cmpanel__follow">
            <div className="fdrop mpage__follow ">
              <button type="button" className="btn btn--soft mpage__follow-btn " aria-haspopup="menu" aria-expanded="false" aria-pressed="false">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1-1-1z"></path>
                </svg>
                <span>Follow</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6"></path>
                </svg>
              </button>
            </div>
          </div>

          <button type="button" className="rpage-cmpanel__close" aria-label="Close comments" title="Close" onClick={() => setActiveDialog(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6l-12 12"></path>
            </svg>
          </button>
        </div>

        <div className="rpage-cmpanel__body" style={{ overflowY: 'auto', height: 'calc(100% - 60px)' }}>
          {chapterDetails?.id && (
            <CommentsSection targetId={chapterDetails.id} type="chapter" />
          )}
        </div>
      </aside>
    </div>
  );
}