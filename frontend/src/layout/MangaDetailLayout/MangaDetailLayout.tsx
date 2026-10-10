import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Bookmark, BookOpen, Check, ChevronDown, Flag, RotateCcw, Search, Star } from 'lucide-react';
import { comicApi } from '../../services/api';
import useContentFilter from '../../hooks/useContentFilter';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Chapter, Comic } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import { formatCount, getComicTitle } from '../../helpers/utils';
import cx from '../../helpers/cx';
import Cover from '../../components/Cover/Cover';
import Pagination from '../../components/Pagination/Pagination';
import CommentsSection from '../../components/CommentsSection/CommentsSection';
import ComicShelf from '../../components/ComicShelf/ComicShelf';
import ReportDialog from '../../components/ReportDialog/ReportDialog';
import AuthModalLayout from '../AuthModalLayout/AuthModalLayout';
import styles from './MangaDetailLayout.module.css';

const CHAPTERS_PER_PAGE = 30;
type SortOrder = 'desc' | 'asc';

const RATING_TONE: Record<string, string> = {
  safe: 'badge--ok',
  suggestive: 'badge--warn',
  erotica: 'badge--err',
  pornographic: 'badge--err',
};

export default function MangaDetailLayout() {
  const navigate = useNavigate();
  const { comicUrl } = useParams<{ comicUrl: string }>();
  const [searchParams] = useSearchParams();
  const commentTargetId = searchParams.get('cm_id') || undefined;
  const { isLoggedIn } = useAuth();
  const toast = useToast();

  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [isRating, setIsRating] = useState(false);

  const [showFullDesc, setShowFullDesc] = useState(false);
  const [chapterQuery, setChapterQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [chapterPage, setChapterPage] = useState(1);
  const contentFilter = useContentFilter();
  const [similar, setSimilar] = useState<Comic[]>([]);

  useEffect(() => {
    if (!comicUrl) return;
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([comicApi.getByUrl(comicUrl), comicApi.getChaptersByUrl(comicUrl)]).then(
      ([comicResult, chaptersResult]) => {
        if (cancelled) return;
        const loaded = comicResult.status === 'fulfilled' ? comicResult.value : null;
        setComic(loaded ?? null);
        setUserRating(typeof loaded?.userRating === 'number' ? loaded.userRating : 0);
        setChapters(chaptersResult.status === 'fulfilled' ? chaptersResult.value || [] : []);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [comicUrl]);

  // Logging in or out on this page: refresh the per-user fields (rating, reading progress) quietly.
  const loadedUrl = comic?.url;
  useEffect(() => {
    if (!loadedUrl) return;
    let cancelled = false;
    comicApi
      .getByUrl(loadedUrl)
      .then((fresh) => {
        if (cancelled) return;
        setUserRating(fresh.userRating || 0);
        setComic((prev) => (prev ? { ...prev, userRating: fresh.userRating, progress: fresh.progress ?? null } : prev));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Only on login/logout; the main effect already loaded this comic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (!comic?.id || !isLoggedIn) {
      setIsFollowing(false);
      return;
    }
    comicApi
      .getFollowStatus(comic.id)
      .then((res) => setIsFollowing(Boolean(res?.isFollowing)))
      .catch(() => setIsFollowing(false));
  }, [comic?.id, isLoggedIn]);

  // "Similar comics": closest in genres, formats, demographic and type.
  const comicId = comic?.id;
  useEffect(() => {
    if (!comicId) return;
    let cancelled = false;
    comicApi
      .getSimilar(comicId, 12, contentFilter)
      .then((data) => !cancelled && setSimilar(data || []))
      .catch(() => !cancelled && setSimilar([]));
    return () => {
      cancelled = true;
    };
  }, [comicId, contentFilter]);

  // Reset to the first page whenever the visible set changes.
  useEffect(() => setChapterPage(1), [chapterQuery, sortOrder]);

  const visibleChapters = useMemo(() => {
    const term = chapterQuery.trim().toLowerCase();
    const filtered = term
      ? chapters.filter(
          (ch) => String(ch.chapterNumber ?? '').includes(term) || (ch.title || '').toLowerCase().includes(term),
        )
      : chapters;
    const dir = sortOrder === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => dir * ((a.chapterNumber || 0) - (b.chapterNumber || 0)));
  }, [chapters, chapterQuery, sortOrder]);

  const firstChapter = useMemo(
    () => chapters.reduce<Chapter | null>((min, ch) => (!min || ch.chapterNumber < min.chapterNumber ? ch : min), null),
    [chapters],
  );

  // "Continue" only when the chapter last opened is still in the public list.
  const continueChapter = useMemo(
    () => chapters.find((ch) => ch.id === comic?.progress?.lastChapterId) ?? null,
    [chapters, comic?.progress?.lastChapterId],
  );
  const readIds = useMemo(() => new Set(comic?.progress?.readChapterIds ?? []), [comic?.progress?.readChapterIds]);

  const alternativeTitles = useMemo(
    () => (comic?.names || []).map((n) => n?.name).filter((n): n is string => Boolean(n) && n !== comic?.name),
    [comic],
  );

  const requireAuth = () => {
    if (!isLoggedIn) setIsAuthOpen(true);
    return isLoggedIn;
  };

  const toggleFollow = async () => {
    if (!comic?.id || !requireAuth()) return;
    try {
      const next = !isFollowing;
      const res = next ? await comicApi.follow(comic.id) : await comicApi.unfollow(comic.id);
      const resolved = res?.isFollowing ?? next;
      setIsFollowing(resolved);
      setComic((prev) => (prev ? { ...prev, follow: Math.max(0, (prev.follow || 0) + (resolved ? 1 : -1)) } : prev));
    } catch (err) {
      toast.error(err, 'Could not update your library.');
    }
  };

  // Clicking your current rating again takes it back.
  const submitRating = async (rating: number) => {
    if (!comic?.id || !requireAuth()) return;
    setIsRating(true);
    try {
      const res = rating === userRating ? await comicApi.unrate(comic.id) : await comicApi.rate(comic.id, rating);
      const mine = res?.userRating ?? 0;
      setUserRating(mine);
      setComic((prev) => (prev ? { ...prev, rating: res?.newAverageRating ?? prev.rating, userRating: mine } : prev));
    } catch (err) {
      toast.error(err, 'Could not save your rating.');
    } finally {
      setIsRating(false);
    }
  };

  if (loading) {
    return <div className={styles.state}>Loading comic…</div>;
  }

  if (!comic) {
    return (
      <div className={styles.state}>
        <h2>Comic not found</h2>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
          Back to home
        </button>
      </div>
    );
  }

  const title = getComicTitle(comic);
  const cover = getImage(comic.coverUrl);
  const pageCount = Math.max(1, Math.ceil(visibleChapters.length / CHAPTERS_PER_PAGE));
  const pageChapters = visibleChapters.slice((chapterPage - 1) * CHAPTERS_PER_PAGE, chapterPage * CHAPTERS_PER_PAGE);
  const shownStars = ratingHover || userRating;

  // Every value opens Browse filtered by it.
  const browse = (key: string, value: string) => `/browse?${new URLSearchParams({ [key]: value.toLowerCase() })}`;
  const details: { label: string; values: string[]; param: string }[] = [
    { label: 'Genres', values: comic.genres ?? [], param: 'genre' },
    { label: 'Formats', values: comic.formats ?? [], param: 'format' },
    { label: 'Author', values: comic.author ? [comic.author] : [], param: 'search' },
    { label: 'Artist', values: comic.artist ? [comic.artist] : [], param: 'search' },
  ];

  return (
    <div className={styles.page}>
      {/* Blurred cover backdrop */}
      <div className={styles.backdrop} style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />

      <section className={styles.hero}>
        <div className={styles.coverCol}>
          <Cover src={cover} alt={title} className={styles.cover} />

          <div className={styles.actions}>
            {continueChapter ? (
              <Link to={`/comics/${comic.url}/${continueChapter.id}`} className="btn btn--primary" title={`Page ${comic.progress?.lastPage ?? 1}`}>
                <BookOpen size={16} />
                Continue · Ch. {continueChapter.chapterNumber}
              </Link>
            ) : firstChapter ? (
              <Link to={`/comics/${comic.url}/${firstChapter.id}`} className="btn btn--primary">
                <BookOpen size={16} />
                Start reading
              </Link>
            ) : (
              <button type="button" className="btn btn--primary" disabled>
                <BookOpen size={16} />
                No chapters yet
              </button>
            )}

            <button
              type="button"
              className={cx('btn', isFollowing ? 'btn--success' : 'btn--ghost')}
              onClick={toggleFollow}
              aria-pressed={isFollowing}
            >
              <Bookmark size={15} fill={isFollowing ? 'currentColor' : 'none'} />
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>

          <div className={styles.rateBox}>
            <div className={styles.rateStars} role="radiogroup" aria-label="Rate this title" onMouseLeave={() => setRatingHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={userRating === star}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  className={cx(styles.rateStar, shownStars >= star && styles.rateStarOn)}
                  onMouseEnter={() => setRatingHover(star)}
                  onClick={() => submitRating(star)}
                  disabled={isRating}
                >
                  <Star size={35} strokeWidth={1.5}/>
                </button>
              ))}
            </div>
            <span className={styles.rateLabel}>
              {userRating ? `Your rating: ${userRating}/5 · click it again to remove` : 'Rate this title'}
            </span>
          </div>

          {continueChapter && firstChapter && continueChapter.id !== firstChapter.id ? (
            <Link to={`/comics/${comic.url}/${firstChapter.id}`} className={styles.reportBtn}>
              <RotateCcw size={13} />
              Read from the beginning
            </Link>
          ) : null}

          <button type="button" className={styles.reportBtn} onClick={() => requireAuth() && setIsReportOpen(true)}>
            <Flag size={13} />
            Report an issue
          </button>
        </div>

        <div className={styles.info}>
          <div className={styles.badges}>
            <Link to={browse('type', comic.types || 'manga')} className="badge badge--brand">
              {comic.types || 'Manga'}
            </Link>
            {comic.contentRating ? (
              <span className={cx('badge', RATING_TONE[comic.contentRating.toLowerCase()])}>{comic.contentRating}</span>
            ) : null}
            {comic.releaseStatus ? (
              <Link to={browse('status', comic.releaseStatus)} className="badge badge--info">
                {comic.releaseStatus}
              </Link>
            ) : null}
            {comic.releasingYear ? <span className="badge mono">{comic.releasingYear}</span> : null}
          </div>

          <h1 className={styles.title}>{title}</h1>
          {alternativeTitles.length > 0 ? <p className={styles.altTitles}>{alternativeTitles.join(' · ')}</p> : null}

          <dl className={styles.stats}>
            <div>
              <dd>
                <Star size={12} className={styles.statStar} />
                {comic.rating ? comic.rating.toFixed(1) : '—'}
                <span>ratings</span>
              </dd>
            </div>
            <div>
              <dd>{formatCount(comic.follow)}</dd>
                <span>follows</span>
            </div>
            <div>
              <dd>{formatCount(comic.view)}</dd>
                <span>views</span>
            </div>
          </dl>

          <div className={styles.synopsis}>
            <h2 className={styles.subheading}>Synopsis</h2>
            <p className={cx(styles.desc, showFullDesc && styles.descOpen)}>
              {comic.description || 'No description yet.'}
            </p>
            {comic.description && comic.description.length > 280 ? (
              <button type="button" className={styles.moreBtn} onClick={() => setShowFullDesc((v) => !v)}>
                {showFullDesc ? 'Show less' : 'Read more'}
                <ChevronDown size={14} className={cx(showFullDesc && styles.flip)} />
              </button>
            ) : null}
          </div>

          <dl className={styles.details}>
            {details.map(({ label, values, param }) => (
              <div key={label} className={styles.detailRow}>
                <dt>{label}</dt>
                <dd>
                  {values.length > 0 ? (
                    values.map((v) => (
                      <Link key={v} to={browse(param, v)} className={cx('chip', styles.chipLink)}>
                        {v}
                      </Link>
                    ))
                  ) : (
                    <span className={styles.muted}>Updating</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="chapters-heading">
        <header className={styles.panelHead}>
          <h2 id="chapters-heading" className={styles.panelTitle}>
            Chapters <span className={styles.panelCount}>{chapters.length}</span>
          </h2>

          <div className={styles.toolbar}>
            <label className={styles.chapterSearch}>
              <Search size={14} />
              <input
                type="search"
                placeholder="Find a chapter…"
                value={chapterQuery}
                onChange={(e) => setChapterQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
              title="Toggle sort order"
            >
              {sortOrder === 'desc' ? <ArrowDownWideNarrow size={14} /> : <ArrowUpNarrowWide size={14} />}
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </button>
          </div>
        </header>

        {pageChapters.length > 0 ? (
          <ul className={styles.chapterList}>
            {pageChapters.map((ch) => (
              <li key={ch.id}>
                <Link to={`/comics/${comic.url}/${ch.id}`} className={cx(styles.chapter, readIds.has(ch.id) && styles.chapterRead)}>
                  {readIds.has(ch.id) ? <Check size={14} className={styles.readMark} aria-label="Read" /> : null}
                  <span className={styles.chapterNum}>Chapter {ch.chapterNumber}</span>
                  {ch.title ? <span className={styles.chapterTitle}>{ch.title}</span> : null}
                  <span className={styles.chapterTime}>{formatTimeAgo(ch.updatedAt || ch.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">{chapterQuery ? 'No chapters match your search.' : 'No chapters yet.'}</div>
        )}

        <Pagination currentPage={chapterPage} totalPages={pageCount} onPageChange={setChapterPage} />
      </section>

      {similar.length > 0 ? (
        <ComicShelf
          headingId="similar-heading"
          title="Similar comics"
          comics={similar}
          caption={(item) => item.genres?.join(' · ') || null}
          className={styles.similar}
        />
      ) : null}

      <div className={styles.comments}>
        <CommentsSection id={comic.id} targetId={commentTargetId} type="comic" />
      </div>

      <ReportDialog
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="comic"
        targetId={comic.id}
        targetLabel={title}
      />
      <AuthModalLayout isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
