import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  Keyboard,
  ListOrdered,
  MessageSquare,
  Minus,
  Plus,
  Settings2,
} from 'lucide-react';
import { API_UPLOADS, chapterApi, comicApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Chapter, ChapterImage, Comic } from '../../types/types';
import { getComicTitle } from '../../helpers/utils';
import cx from '../../helpers/cx';
import Modal from '../../components/Modal/Modal';
import CommentsSection from '../../components/CommentsSection/CommentsSection';
import useReaderSettings, { WIDTH_LIMITS } from './useReaderSettings';
import { ReaderChapterList, ReaderSettingsPanel, ReaderShortcuts } from './ReaderPanels';
import styles from './MangaReaderLayout.module.css';

type Panel = 'settings' | 'chapters' | 'comments' | 'help' | null;

const HISTORY_DEBOUNCE_MS = 800;
const HISTORY_HEARTBEAT_MS = 15000;
const EAGER_PAGES = 3;

const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');

const toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  else document.documentElement.requestFullscreen().catch(() => undefined);
};

export default function MangaReaderLayout() {
  const { comicUrl, chapterId } = useParams<{ comicUrl: string; chapterId: string }>();
  const [searchParams] = useSearchParams();
  const commentTargetId = searchParams.get('cm_id') || undefined;
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { settings, update, reset } = useReaderSettings();

  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [showControls, setShowControls] = useState(true);

  const mainRef = useRef<HTMLElement>(null);
  const currentPageRef = useRef(1);
  const restorePageRef = useRef<number | null>(null);

  const isStrip = settings.direction === 'ttb';
  const totalPages = images.length;

  /* ---------------- Data ---------------- */

  useEffect(() => {
    if (!comicUrl) return;
    let cancelled = false;
    Promise.all([comicApi.getByUrl(comicUrl), comicApi.getChaptersByUrl(comicUrl)])
      .then(([comicData, chapterData]) => {
        if (cancelled) return;
        setComic(comicData ?? null);
        setChapters([...(chapterData ?? [])].sort((a, b) => a.chapterNumber - b.chapterNumber));
      })
      .catch((err) => console.error('Unable to load comic / chapters:', err));
    return () => {
      cancelled = true;
    };
  }, [comicUrl]);

  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setImages([]);

    chapterApi
      .getDetails(chapterId)
      .then((data) => {
        if (cancelled) return;
        const pages = [...((data.images ?? []) as ChapterImage[])].sort((a, b) => a.pageNumber - b.pageNumber);
        const start = Math.max(1, Number(data.metadata?.currentPage) || 1);
        setImages(pages.map((img) => `${API_UPLOADS}${img.urlPath}`));
        setChapterNumber(data.chapterNumber ?? null);
        setCurrentPage(start);
        currentPageRef.current = start;
        restorePageRef.current = start;
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load this chapter.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const index = chapters.findIndex((ch) => ch.id === chapterId);
  const prevChapter = index > 0 ? chapters[index - 1] : null;
  const nextChapter = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;
  const displayNumber = chapterNumber ?? chapters[index]?.chapterNumber;
  const title = comic ? getComicTitle(comic) : '';

  /* ---------------- Reading history ---------------- */

  const saveProgress = useCallback(
    (id: string | undefined, page: number) => {
      if (!id || !isLoggedIn) return;
      chapterApi.saveReadingHistory(id, page).catch((err) => console.debug('Unable to save reading history', err));
    },
    [isLoggedIn],
  );

  useEffect(() => {
    currentPageRef.current = currentPage;
    if (restorePageRef.current !== null) return; // don't overwrite history before the saved page is restored
    const timer = window.setTimeout(() => saveProgress(chapterId, currentPage), HISTORY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [currentPage, chapterId, saveProgress]);

  // Heartbeat + final save when leaving the chapter.
  useEffect(() => {
    const interval = window.setInterval(() => saveProgress(chapterId, currentPageRef.current), HISTORY_HEARTBEAT_MS);
    return () => {
      window.clearInterval(interval);
      saveProgress(chapterId, currentPageRef.current);
    };
  }, [chapterId, saveProgress]);

  /* ---------------- Navigation ---------------- */

  const pageElement = (page: number) => mainRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);

  const goToPage = useCallback(
    (page: number, smooth = settings.smoothScroll) => {
      const target = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
      setCurrentPage(target);
      if (isStrip) {
        mainRef.current
          ?.querySelector<HTMLElement>(`[data-page="${target}"]`)
          ?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      } else {
        window.scrollTo({ top: 0 });
      }
    },
    [isStrip, settings.smoothScroll, totalPages],
  );

  const openChapter = useCallback(
    (id: string | undefined) => {
      if (!id || id === chapterId) return;
      saveProgress(chapterId, currentPageRef.current);
      setPanel((p) => (p === 'chapters' ? null : p));
      window.scrollTo({ top: 0 });
      navigate(`/comics/${comicUrl}/${id}`);
    },
    [chapterId, comicUrl, navigate, saveProgress],
  );

  const prevPage = useCallback(() => {
    if (currentPageRef.current > 1) goToPage(currentPageRef.current - 1);
    else openChapter(prevChapter?.id);
  }, [goToPage, openChapter, prevChapter]);

  const nextPage = useCallback(() => {
    if (currentPageRef.current < totalPages) goToPage(currentPageRef.current + 1);
    else openChapter(nextChapter?.id);
  }, [goToPage, openChapter, nextChapter, totalPages]);

  // Restore the saved page once the strip has rendered.
  useEffect(() => {
    const page = restorePageRef.current;
    if (loading || page === null || totalPages === 0) return;
    if (isStrip && page > 1) pageElement(page)?.scrollIntoView({ block: 'start' });
    restorePageRef.current = null;
  }, [loading, totalPages, isStrip]);

  // Track which page is in view while scrolling the strip.
  useEffect(() => {
    if (!isStrip || loading || totalPages === 0 || !mainRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const closest = visible.reduce((a, b) =>
          Math.abs(a.boundingClientRect.top) < Math.abs(b.boundingClientRect.top) ? a : b,
        );
        const page = Number((closest.target as HTMLElement).dataset.page);
        if (page && page !== currentPageRef.current) setCurrentPage(page);
      },
      { rootMargin: '-25% 0px -40% 0px', threshold: 0 },
    );

    mainRef.current.querySelectorAll('[data-page]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isStrip, loading, totalPages]);

  // Smooth keyboard/anchor scrolling preference.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = settings.smoothScroll ? 'smooth' : 'auto';
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, [settings.smoothScroll]);

  /* ---------------- Keyboard ---------------- */

  // Latest handlers for the single, mount-time keydown listener.
  const keyActions = useRef({ prevPage, nextPage, openChapter, prevChapter, nextChapter, rtl: false });
  useEffect(() => {
    keyActions.current = { prevPage, nextPage, openChapter, prevChapter, nextChapter, rtl: settings.direction === 'rtl' };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = keyActions.current;
      const back = a.rtl ? a.nextPage : a.prevPage;
      const forward = a.rtl ? a.prevPage : a.nextPage;

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
          back();
          break;
        case 'arrowright':
        case 'd':
          forward();
          break;
        case 'b':
        case '[':
          a.openChapter(a.prevChapter?.id);
          break;
        case 'n':
        case ']':
          a.openChapter(a.nextChapter?.id);
          break;
        case 'm':
        case 'c':
          setPanel((p) => (p === 'comments' ? null : 'comments'));
          break;
        case 'h':
        case '?':
          setPanel((p) => (p === 'help' ? null : 'help'));
          break;
        case 'x':
          setShowControls((v) => !v);
          break;
        case 'f':
          toggleFullscreen();
          break;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------- Render ---------------- */

  const pageStyle = useMemo(
    () =>
      ({
        '--page-width': `${settings.width}%`,
        '--page-gap': `${settings.gap}rem`,
        '--page-dim': `${1 - settings.dim / 100}`,
      }) as React.CSSProperties,
    [settings.width, settings.gap, settings.dim],
  );

  const onPageClick = (e: React.MouseEvent<HTMLElement>) => {
    if (isStrip) {
      setShowControls((v) => !v);
      return;
    }
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - left) / width;
    if (ratio > 0.35 && ratio < 0.65) setShowControls((v) => !v);
    else if (ratio <= 0.35 === (settings.direction !== 'rtl')) prevPage();
    else nextPage();
  };

  const togglePanel = (next: Exclude<Panel, null>) => setPanel((p) => (p === next ? null : next));
  const progress = totalPages ? (currentPage / totalPages) * 100 : 0;

  return (
    <div
      className={cx(
        styles.reader,
        !showControls && styles.controlsHidden,
        settings.greyscale && styles.greyscale,
        settings.progress !== 'off' && styles[`progress-${settings.progress}`],
      )}
      style={pageStyle}
    >
      {/* Top bar */}
      <header className={styles.topbar}>
        <Link to={`/comics/${comicUrl}`} className={styles.back} title="Back to comic">
          <ArrowLeft size={18} />
          <span className={styles.backText}>
            <span className={styles.backTitle}>{title || 'Back'}</span>
            {displayNumber !== undefined ? <span className={styles.backSub}>Chapter {displayNumber}</span> : null}
          </span>
        </Link>

        <div className={styles.chapterNav}>
          <button
            type="button"
            className={styles.barBtn}
            disabled={!prevChapter}
            onClick={() => openChapter(prevChapter?.id)}
            aria-label="Previous chapter"
            title="Previous chapter (B)"
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" className={styles.chapterPick} onClick={() => togglePanel('chapters')}>
            <ListOrdered size={15} />
            <span>Ch. {displayNumber ?? '–'}</span>
          </button>
          <button
            type="button"
            className={styles.barBtn}
            disabled={!nextChapter}
            onClick={() => openChapter(nextChapter?.id)}
            aria-label="Next chapter"
            title="Next chapter (N)"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className={styles.barActions}>
          <button
            type="button"
            className={cx(styles.barBtn, panel === 'comments' && styles.barBtnOn)}
            onClick={() => togglePanel('comments')}
            aria-label="Comments"
            title="Comments (M)"
          >
            <MessageSquare size={18} />
          </button>
          <button
            type="button"
            className={cx(styles.barBtn, panel === 'settings' && styles.barBtnOn)}
            onClick={() => togglePanel('settings')}
            aria-label="Reader settings"
            title="Settings"
          >
            <Settings2 size={18} />
          </button>
          <button type="button" className={cx(styles.barBtn, styles.hideMobile)} onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen (F)">
            <Expand size={18} />
          </button>
          <button type="button" className={cx(styles.barBtn, styles.hideMobile)} onClick={() => togglePanel('help')} aria-label="Keyboard shortcuts" title="Shortcuts (?)">
            <Keyboard size={18} />
          </button>
        </div>
      </header>

      {/* Page progress */}
      {settings.progress !== 'off' && totalPages > 0 ? (
        <div className={styles.progress} aria-label={`Page ${currentPage} of ${totalPages}`}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={cx(styles.progressSeg, i + 1 <= currentPage && styles.progressSegDone)}
              title={`Page ${i + 1}`}
              aria-label={`Go to page ${i + 1}`}
              onClick={() => goToPage(i + 1)}
            />
          ))}
        </div>
      ) : null}

      {/* Pages */}
      <main ref={mainRef} className={cx(styles.stage, isStrip ? styles.strip : styles.single)}>
        {loading ? (
          <div className={styles.loader}>
            <span className={styles.spinner} />
            Loading chapter…
          </div>
        ) : error ? (
          <div className={styles.loader}>{error}</div>
        ) : isStrip ? (
          images.map((src, i) => (
            <figure key={src} className={styles.page} data-page={i + 1} onClick={onPageClick}>
              <img
                src={src}
                alt={`Page ${i + 1}`}
                loading={settings.preloadAll || i < EAGER_PAGES ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </figure>
          ))
        ) : images[currentPage - 1] ? (
          <figure className={styles.page} data-page={currentPage} onClick={onPageClick}>
            <img src={images[currentPage - 1]} alt={`Page ${currentPage}`} decoding="async" referrerPolicy="no-referrer" />
            {/* Preload neighbours for instant page turns */}
            {[currentPage, currentPage - 2].map((i) =>
              images[i] ? <link key={i} rel="preload" as="image" href={images[i]} /> : null,
            )}
          </figure>
        ) : null}

        {!loading && !error ? (
          <section className={styles.ending}>
            <p className={styles.endingKicker}>End of chapter {displayNumber}</p>
            <Link to={`/comics/${comicUrl}`} className={styles.endingTitle}>
              {title}
            </Link>
            <div className={styles.endingNav}>
              <button type="button" className="btn btn--ghost" disabled={!prevChapter} onClick={() => openChapter(prevChapter?.id)}>
                <ChevronLeft size={16} />
                {prevChapter ? `Chapter ${prevChapter.chapterNumber}` : 'No previous'}
              </button>
              <button type="button" className="btn btn--primary" disabled={!nextChapter} onClick={() => openChapter(nextChapter?.id)}>
                {nextChapter ? `Chapter ${nextChapter.chapterNumber}` : 'Latest chapter'}
                <ChevronRight size={16} />
              </button>
            </div>

            {chapterId && panel !== 'comments' ? (
              <div className={styles.endingComments}>
                <CommentsSection id={chapterId} targetId={commentTargetId} type="chapter" />
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      {/* Floating page / zoom pill */}
      {totalPages > 0 ? (
        <div className={styles.pill}>
          <span className={cx(styles.pillPages, 'mono')}>
            {currentPage} / {totalPages}
          </span>
          <span className={styles.pillTrack} aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
          <span className={cx(styles.pillZoom, styles.hideMobile)}>
            <button
              type="button"
              aria-label="Narrower pages"
              disabled={settings.width <= WIDTH_LIMITS.min}
              onClick={() => update('width', settings.width - WIDTH_LIMITS.step)}
            >
              <Minus size={14} />
            </button>
            <span className="mono">{settings.width}%</span>
            <button
              type="button"
              aria-label="Wider pages"
              disabled={settings.width >= WIDTH_LIMITS.max}
              onClick={() => update('width', settings.width + WIDTH_LIMITS.step)}
            >
              <Plus size={14} />
            </button>
          </span>
        </div>
      ) : null}

      {/* Panels */}
      <Modal isOpen={panel === 'settings'} onClose={() => setPanel(null)} variant="side" title="Reader settings">
        <ReaderSettingsPanel settings={settings} update={update} reset={reset} />
      </Modal>

      <Modal isOpen={panel === 'chapters'} onClose={() => setPanel(null)} variant="side" title="Chapters" subtitle={title}>
        <ReaderChapterList chapters={chapters} currentId={chapterId} onSelect={openChapter} />
      </Modal>

      <Modal isOpen={panel === 'comments'} onClose={() => setPanel(null)} variant="side" title={`Chapter ${displayNumber ?? ''} comments`} bodyClassName={styles.commentsBody}>
        {chapterId ? <CommentsSection id={chapterId} targetId={commentTargetId} type="chapter" /> : null}
      </Modal>

      <Modal isOpen={panel === 'help'} onClose={() => setPanel(null)} size="sm" title="Keyboard shortcuts">
        <ReaderShortcuts />
      </Modal>
    </div>
  );
}
