import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { formatTimeAgo } from '../../helpers/formatDate';
import { API_UPLOADS, comicApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Chapter, Comic } from '../../types/types';
import CommentsSection from '../../components/CommentsSection/CommentsSection';
import AuthModalLayout from '../AuthModalLayout/AuthModalLayout';
import styles from './MangaDetailLayout.module.css';

export default function MangaDetailLayout() {
  const navigate = useNavigate();
  const { comicUrl } = useParams<{ comicUrl: string }>();
  const { isLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const cmId = searchParams.get('cm_id') || undefined;

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Comic data state
  const [comic, setComic] = useState<Comic | null>(null);
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Interaction state
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [ratingHover, setRatingHover] = useState<number>(0);
  const [userRating, setUserRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  // UI toggle state
  const [showAlts, setShowAlts] = useState<boolean>(false);
  const [showFullDesc, setShowFullDesc] = useState<boolean>(false);
  const [showDetailsShell, setShowDetailsShell] = useState<boolean>(false);
  const [chapterSearch, setChapterSearch] = useState<string>('');

  // Calculate formatted follow count (e.g., converts 1500 to 1.5K)
  const localFollowsCount = useMemo(() => {
    if (!comic) return 0;
    const baseFollows = comic.follow || 0;
    if (baseFollows === 0) return 0;
    return Math.max(0.1, Math.round(baseFollows / 100) / 10);
  }, [comic]);

  // Navigate to chapter reader
  const onRead = (chapterId: string) => navigate(`${chapterId}`);

  // Fetch comic details and chapter list
  useEffect(() => {
    if (!comicUrl) return;

    const fetchComicData = async () => {
      try {
        setLoading(true);
        const [comicResult, chaptersResult] = await Promise.allSettled([
          comicApi.getByUrl(comicUrl),
          comicApi.getChaptersByUrl(comicUrl),
        ]);

        if (comicResult.status === 'fulfilled' && comicResult.value) {
          setComic(comicResult.value);
          setUserRating(
            typeof comicResult.value.userRating === 'number'
              ? comicResult.value.userRating
              : 0
          );
        } else {
          setComic(null);
          setUserRating(0);
        }

        if (chaptersResult.status === 'fulfilled') {
          setChaptersList(chaptersResult.value || []);
        } else {
          setChaptersList([]);
        }
      } catch (error) {
        setComic(null);
        setChaptersList([]);
        console.error('Error loading comic data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComicData();
  }, [comicUrl]);

  // Fetch follow state
  useEffect(() => {
    const fetchFollowState = async () => {
      if (!comic?.id || !isLoggedIn) {
        setIsFollowing(false);
        return;
      }

      try {
        const response = await comicApi.getFollowStatus(comic.id);
        setIsFollowing(Boolean(response?.isFollowing));
      } catch (error) {
        setIsFollowing(false);
      }
    };

    fetchFollowState();
  }, [comic?.id, isLoggedIn]);

  const requireAuth = () => {
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleFollowToggle = async () => {
    if (!comic?.id) return;
    if (!requireAuth()) return;

    try {
      const nextState = !isFollowing;
      const response = nextState
        ? await comicApi.follow(comic.id)
        : await comicApi.unfollow(comic.id);
      const resolved = response?.isFollowing ?? nextState;
      setIsFollowing(resolved);
      setComic((prev) =>
        prev
          ? {
              ...prev,
              follow: Math.max(0, (prev.follow || 0) + (resolved ? 1 : -1)),
            }
          : prev
      );
    } catch (error) {
      console.error('Unable to update follow state:', error);
    }
  };

  const handleRatingSubmit = async (rating: number) => {
    if (!comic?.id) return;
    if (!requireAuth()) return;

    try {
      setIsSubmittingRating(true);
      const response = await comicApi.rate(comic.id, rating);
      setUserRating(response?.userRating ?? rating);
      setComic((prev) =>
        prev
          ? {
              ...prev,
              rating: response?.newAverageRating ?? prev.rating,
              userRating: response?.userRating ?? rating,
            }
          : prev
      );
    } catch (error) {
      console.error('Unable to submit rating:', error);
      alert('Unable to submit your rating right now.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const alternativeTitles = useMemo(() => {
    if (!comic) return [];

    const names = (comic.names || [])
      .map((entry) => entry?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names : comic.name ? [comic.name] : [];
  }, [comic]);

  // Filter chapters by search query
  const filteredChapters = useMemo(() => {
    const term = chapterSearch.toLowerCase().trim();
    if (!term) return chaptersList;

    return chaptersList.filter((ch) => {
      const numStr = String(ch.chapterNumber || '');
      const titleStr = (ch.title || '').toLowerCase();
      return numStr.includes(term) || titleStr.includes(term);
    });
  }, [chaptersList, chapterSearch]);

  // Sort filtered chapters
  const sortedChapters = useMemo(() => {
    return [...filteredChapters].sort((a, b) => {
      const numA = a.chapterNumber || 0;
      const numB = b.chapterNumber || 0;
      return sortOrder === 'newest' ? numB - numA : numA - numB;
    });
  }, [filteredChapters, sortOrder]);

  // Memoize first chapter to avoid sorting inside render loop
  const firstChapter = useMemo(() => {
    if (chaptersList.length === 0) return null;
    return [...chaptersList].sort(
      (a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)
    )[0];
  }, [chaptersList]);

  if (loading) {
    return (
      <div className={styles['manga-details-container'] || 'manga-details-container'} style={{ padding: '80px', textAlign: 'center' }}>
        <h2>Loading comic information...</h2>
      </div>
    );
  }

  if (!comic) {
    return (
      <div className={styles['manga-details-container'] || 'manga-details-container'} style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Comic not found.</h2>
        <button
          onClick={() => navigate('/')}
          className={`${styles['btn']} ${styles['btn--primary']}`}
          style={{ width: 'auto', display: 'inline-block', marginTop: '15px' }}
        >
          Back to home
        </button>
      </div>
    );
  }

  const primaryName = comic.name || comic.names?.[0]?.name || 'Untitled';
  const coverSrc = comic.coverUrl ? `${API_UPLOADS}${comic.coverUrl}` : '/images/placeholder.png';

  return (
    <div className={`${styles['layout']} ${styles['layout--single']}`}>
      <article className={styles['mpage']} id={`manga-detail-${comic.id}`}>
        <div id="mal-sync"></div>

        {/* HEADER HERO SECTION */}
        <header className={styles['mpage__hero']}>
          <div className={styles['mpage__hero-inner']}>
            {/* LEFT COLUMN: POSTER AND ACTIONS */}
            <div className={styles['mpage__poster']}>
              <div className={styles['poster']}>
                <img
                  sizes="(max-width: 720px) 50vw, 220px"
                  alt={primaryName}
                  src={coverSrc}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className={styles['mpage__poster-actions']}>
                <Link
                  to={firstChapter ? `/chapter/${firstChapter.id}` : '#'}
                  className={`${styles['btn']} ${styles['btn--primary']} ${styles['mpage__read']} ${!firstChapter ? styles['disabled'] || 'disabled' : ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 4.5h7.5a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2zM22 4.5h-7.5a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z"></path>
                  </svg>
                  <span>Start reading</span>
                </Link>

                {/* Follow Button */}
                <div className={`${styles['fdrop']} ${styles['mpage__follow']}`}>
                  <button
                    type="button"
                    className={`${styles['btn']} ${styles['btn--soft']} ${styles['mpage__follow-btn']} ${isFollowing ? styles['is-on'] : ''}`}
                    onClick={handleFollowToggle}
                    aria-pressed={isFollowing}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFollowing ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"></path>
                    </svg>
                    <span>{isFollowing ? 'Following' : 'Follow'}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6"></path>
                    </svg>
                  </button>
                </div>

                {/* Rating stars */}
                <div className={styles['mpage__rate-stack']}>
                  <div className={styles['mstars']} role="radiogroup" aria-label="Rate this title">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`${styles['mstars__btn']} ${(ratingHover || userRating) >= star ? styles['is-on'] : ''} ${userRating >= star ? styles['is-rated'] : ''}`}
                        aria-label={`Rate ${star} star`}
                        aria-checked={userRating === star}
                        role="radio"
                        onClick={() => handleRatingSubmit(star)}
                        onMouseEnter={() => setRatingHover(star)}
                        onMouseLeave={() => setRatingHover(0)}
                        disabled={isSubmittingRating}
                      >
                        <svg className={`${styles['mstars__svg']} ${styles['mstars__svg--bg']}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.78 5.63 6.22.9-4.5 4.39 1.06 6.18L12 17.4l-5.56 2.92 1.06-6.18L3 9.74l6.22-.9z"></path></svg>
                        <svg className={`${styles['mstars__svg']} ${styles['mstars__svg--fg']}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.78 5.63 6.22.9-4.5 4.39 1.06 6.18L12 17.4l-5.56 2.92 1.06-6.18L3 9.74l6.22-.9z"></path></svg>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Report Action */}
                <div className={styles['mpage__poster-aux']}>
                  <button type="button" className={styles['mpage__action-link']}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Report</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: COMIC DETAILS */}
            <div className={styles['mpage__head']}>
              <div className={styles['mpage__title-row']}>
                <h1 className={styles['mpage__title']}>{primaryName}</h1>
              </div>

              {/* Alternative titles section */}
              <div className={styles['mpage__alts']}>
                <button
                  type="button"
                  className={`${styles['mpage__alts-toggle']} ${showAlts ? styles['is-active'] : ''}`}
                  aria-expanded={showAlts}
                  onClick={() => setShowAlts(!showAlts)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  <span className={styles['mpage__alts-summary']}>
                    {alternativeTitles.join(' / ')}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6"></path>
                  </svg>
                </button>
                <div style={{ height: showAlts ? 'auto' : '0px', overflow: 'hidden', transition: 'height 220ms' }}>
                  <ul className={styles['mpage__alts-list']}>
                    {alternativeTitles.map((titleText: string, idx: number) => (
                      <li key={idx}>{titleText}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Badges */}
              <div className={styles['mpage__badges']}>
                <span className={`${styles['mpage__badge']} ${styles['mpage__badge--type']}`}>{(comic.types || 'MANGA').toUpperCase()}</span>
                <span className={`${styles['mpage__badge']} ${styles['mpage__badge--rating']} ${styles['mpage__badge--rating-safe']}`}>SAFE</span>
                <span className={`${styles['mpage__badge']} ${styles['mono'] || 'mono'}`}>2025</span>
                <span className={`${styles['mpage__badge']} ${styles['mpage__badge--status']} ${styles['mpage__badge--status-releasing']}`}>RELEASING</span>
              </div>

              {/* Stats & Rank Line */}
              <div className={styles['mpage__byline']}>
                <span className={`${styles['mpage__badge']} ${styles['mpage__badge--rank']} ${styles['mpage__rank']}`} title="Ranked #69">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 21h8"></path>
                    <path d="M12 17v4"></path>
                    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path>
                    <path d="M17 4h2a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3"></path>
                    <path d="M7 4H5a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3"></path>
                  </svg>
                  <strong>#69</strong>
                </span>
                <span className={styles['mpage__byline-sep']} aria-hidden="true">·</span>
                <span className={styles['mpage__stat']}>
                  <strong>★ {comic.rating?.toFixed(1) || 'N/A'}</strong>
                  <span className={styles['mpage__stat-sub']}>by 235 users</span>
                </span>
                <span className={styles['mpage__byline-sep']} aria-hidden="true">·</span>
                <span className={styles['mpage__stat']}>
                  <strong>{localFollowsCount}K</strong>
                  <span className={styles['mpage__stat-sub']}>followed</span>
                </span>
              </div>

              {/* Mobile action buttons (CTA) */}
              <div className={styles['mpage__cta']}>
                <button
                  type="button"
                  className={`${styles['btn']} ${styles['btn--primary']} ${styles['mpage__read']}`}
                  onClick={() => firstChapter && onRead(firstChapter.id)}
                  disabled={!firstChapter}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 4.5h7.5a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2zM22 4.5h-7.5a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z"></path>
                  </svg>
                  <span>Start reading</span>
                </button>
              </div>

              {/* Synopsis / Description */}
              <div className={styles['mpage__desc-wrap']}>
                <p className={`${styles['mpage__desc']} ${showFullDesc ? styles['is-expanded'] : ''}`} style={{ WebkitLineClamp: showFullDesc ? 'unset' : 3 }}>
                  {comic.description || "No description cataloged yet."}
                </p>
                <button
                  type="button"
                  className={styles['mpage__desc-toggle']}
                  onClick={() => setShowFullDesc(!showFullDesc)}
                >
                  {showFullDesc ? '[view less]' : '[view more]'}
                </button>
              </div>

              {/* Additional details panel */}
              <div className={styles['mpage__details-shell']}>
                <button
                  type="button"
                  className={styles['mpage__details-shell-toggle']}
                  aria-expanded={showDetailsShell}
                  onClick={() => setShowDetailsShell(!showDetailsShell)}
                >
                  <span>{showDetailsShell ? 'Hide details' : 'Show details'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showDetailsShell ? 'rotate(90deg)' : 'none', transition: 'transform 220ms' }}>
                    <path d="M9 6l6 6-6 6"></path>
                  </svg>
                </button>
                <div className={styles['mpage__details-shell-body']} style={{ height: showDetailsShell ? 'auto' : '0px', overflow: 'hidden', transition: 'height 220ms' }}>
                  <dl className={styles['mpage__details']}>
                    {/* Genres */}
                    <div className={styles['mpage__detail']}>
                      <dt className={styles['mpage__detail-label']}>Genres</dt>
                      <dd className={styles['mpage__detail-items']}>
                        <ul className={styles['mpage__chips']}>
                          {Array.isArray(comic.genres) ? (
                            comic.genres.map((genre, idx) => (
                              <li key={idx}>
                                <span className={styles['mpage__chip']}>{genre}</span>
                              </li>
                            ))
                          ) : (
                            <li><span className={styles['mpage__chip']}>Updating</span></li>
                          )}
                        </ul>
                      </dd>
                    </div>

                    {/* Formats */}
                    <div className={styles['mpage__detail']}>
                      <dt className={styles['mpage__detail-label']}>Formats</dt>
                      <dd className={styles['mpage__detail-items']}>
                        <ul className={styles['mpage__chips']}>
                          {Array.isArray(comic.formats) ? (
                            comic.formats.map((format, idx) => (
                              <li key={idx}>
                                <span className={styles['mpage__chip']}>{format}</span>
                              </li>
                            ))
                          ) : (
                            <li><span className={styles['mpage__chip']}>Updating</span></li>
                          )}
                        </ul>
                      </dd>
                    </div>

                    {/* Authors */}
                    <div className={styles['mpage__detail']}>
                      <dt className={styles['mpage__detail-label']}>Authors</dt>
                      <dd className={styles['mpage__detail-items']}>
                        <ul className={styles['mpage__chips']}>
                          <li>
                            <span className={styles['mpage__chip']}>{comic.author || 'Updating'}</span>
                          </li>
                        </ul>
                      </dd>
                    </div>

                    {/* Artists */}
                    <div className={styles['mpage__detail']}>
                      <dt className={styles['mpage__detail-label']}>Artists</dt>
                      <dd className={styles['mpage__detail-items']}>
                        <ul className={styles['mpage__chips']}>
                          <li>
                            <span className={styles['mpage__chip']}>{comic.artist || 'Updating'}</span>
                          </li>
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* BODY SECTION: CHAPTERS & COMMENTS */}
        <div className={styles['mpage__body']}>
          <div className={styles['mpage__main']}>
            {/* CHAPTER SECTION */}
            <section className={styles['mpage__chapters']}>
              <header className={styles['mpage__sec-head']}>
                <h2 className={styles['mpage__sec-title']}>Chapters</h2>
              </header>

              {/* SEARCH AND SORT TOOLBAR */}
              <div className={styles['mchap-toolbar']}>
                <div className={styles['mchap-search']}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    placeholder="Search chapter…"
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                  />
                </div>
                <div className={`${styles['useg']} ${styles['mchap-toolbar__sort']}`} role="group" aria-label="Sort">
                  <button
                    type="button"
                    className={`${styles['useg__btn']} ${sortOrder === 'newest' ? styles['is-on'] : ''}`}
                    onClick={() => setSortOrder('newest')}
                    title="Sort by chapter (desc)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: sortOrder === 'newest' ? 'none' : 'rotate(180deg)' }}>
                      <path d="M12 5v14"></path>
                      <path d="M19 12l-7 7-7-7"></path>
                    </svg>
                    <span>Chapter</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles['useg__btn']} ${sortOrder === 'oldest' ? styles['is-on'] : ''}`}
                    onClick={() => setSortOrder('oldest')}
                    title="Sort by chapter (asc)"
                  >
                    <span>Oldest</span>
                  </button>
                </div>
              </div>

              {/* CHAPTERS LIST */}
              <ul className={styles['mchap-list']}>
                {sortedChapters.map((ch: Chapter) => {
                  const dateToFormat = ch.updatedAt || ch.createdAt;
                  const formattedDate = dateToFormat ? formatTimeAgo(dateToFormat) : 'Recently';

                  return (
                    <li key={ch.id} className={styles['mchap-item']}>
                      <div className={styles['mchap-row']}>
                        <a
                          className={styles['mchap-row__primary']}
                          href={`#ch-${ch.chapterNumber}`}
                          onClick={(e) => {
                            e.preventDefault();
                            onRead(ch.id);
                          }}
                        >
                          <span className={styles['mchap-row__ch']}>Ch.{ch.chapterNumber}</span>
                          {ch.title && <span className={styles['mchap-row__title']}> - {ch.title}</span>}
                        </a>
                        <div className={styles['mchap-row__secondary']}>
                          <span className={styles['mchap-row__likes']}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9A2 2 0 0 0 19.72 9z"></path>
                              <line x1="7" y1="22" x2="7" y2="11"></line>
                            </svg>
                            12
                          </span>
                          <span className={styles['mchap-row__sep']} aria-hidden="true">·</span>
                          <span className={styles['mchap-row__time']}>{formattedDate}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}

                {sortedChapters.length === 0 && (
                  <li className={styles['mchap-item']} style={{ padding: '24px', justifyContent: 'center', opacity: 0.6 }}>
                    No chapters matching search.
                  </li>
                )}
              </ul>

              {/* Static pagination */}
              {sortedChapters.length > 0 && (
                <div className={styles['mchap-foot']}>
                  <span className={styles['mchap-foot__hint']}>
                    Showing 1 to {Math.min(20, sortedChapters.length)} of {sortedChapters.length} items
                  </span>
                  <nav className={styles['npager']} aria-label="Pagination">
                    <button type="button" className={`${styles['npager__num']} ${styles['is-active']}`} aria-current="page">1</button>
                  </nav>
                </div>
              )}
            </section>

            {/* COMMENTS SECTION */}
            <CommentsSection id={comic.id} targetId={cmId} type="comic" />
          </div>
        </div>
      </article>

      <AuthModalLayout isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}