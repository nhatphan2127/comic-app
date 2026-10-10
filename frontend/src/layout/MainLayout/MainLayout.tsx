import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import type { Comic, RankingPeriod } from '../../types/types';
import ComicCardList from '../../components/ComicCard/ComicCard';
import HeroCarousel from '../../components/HeroCarousel/HeroCarousel';
import Pagination from '../../components/Pagination/Pagination';
import PopularCard from '../../components/PopularCard/PopularCard';
import ContinueReading from '../../components/ContinueReading/ContinueReading';
import ForYou from '../../components/ForYou/ForYou';
import { comicApi } from '../../services/api';
import useContentFilter from '../../hooks/useContentFilter';
import cx from '../../helpers/cx';
import styles from './MainLayout.module.css';

type ViewMode = 'grid' | 'list';

const VIEW_MODES: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: 'grid', label: 'Grid view', icon: LayoutGrid },
  { mode: 'list', label: 'List view', icon: List },
];

export default function MainLayout() {
  const contentFilter = useContentFilter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [comics, setComics] = useState<Comic[]>([]);
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>('week');
  const [rankedComics, setRankedComics] = useState<Comic[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(true);
  const [popular, setPopular] = useState<Comic[]>([]);
  const [isPopularLoading, setIsPopularLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Width of the "Latest updates" column: the recommendation cards are sized as if laid out in it.
  const latestRef = useRef<HTMLElement>(null);
  const [latestWidth, setLatestWidth] = useState<number>();

  useEffect(() => {
    const section = latestRef.current;
    if (!section) return;
    const observer = new ResizeObserver(() => setLatestWidth(section.clientWidth));
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    comicApi
      .list(page, contentFilter)
      .then((data) => {
        if (cancelled) return;
        setComics(data.comics || []);
        setTotalPages(Math.max(1, data.metadata?.totalPages || 1));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not connect to the server');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, contentFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsRankingLoading(true);

    comicApi
      .getRankings(rankingPeriod, 10, contentFilter)
      .then((data) => {
        if (!cancelled) setRankedComics(data || []);
      })
      .catch((err) => console.error('Could not fetch rankings:', err))
      .finally(() => {
        if (!cancelled) setIsRankingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rankingPeriod, contentFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsPopularLoading(true);

    comicApi
      .getPopular(8, contentFilter)
      .then((data) => {
        if (!cancelled) setPopular(data || []);
      })
      .catch((err) => console.error('Could not fetch popular comics:', err))
      .finally(() => {
        if (!cancelled) setIsPopularLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentFilter]);

  const changePage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFirstLoad = isLoading && comics.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <HeroCarousel comics={popular} isLoading={isPopularLoading} />
      </div>

      <ContinueReading className={styles.wide} />

      <ForYou className={styles.wide} cardLayoutWidth={latestWidth} />

      <section ref={latestRef} className={styles.main} aria-labelledby="latest-heading">
        <header className={styles.sectionHead}>
          <div>
            <h2 id="latest-heading" className={styles.title}>
              Latest updates
            </h2>
            <p className={styles.subtitle}>Fresh chapters from the titles you love</p>
          </div>

          <div className={styles.viewToggle} role="group" aria-label="View mode">
            {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                className={cx(styles.viewBtn, viewMode === mode && styles.viewBtnOn)}
                onClick={() => setViewMode(mode)}
                aria-label={label}
                aria-pressed={viewMode === mode}
                title={label}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </header>

        {isFirstLoad ? (
          <p className={styles.state}>Loading comics…</p>
        ) : error ? (
          <p className={cx(styles.state, styles.stateError)}>{error}</p>
        ) : (
          <>
            <div className={cx(styles.results, isLoading && styles.resultsLoading)} aria-busy={isLoading}>
              <ComicCardList comics={comics} viewMode={viewMode} />
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={changePage} isLoading={isLoading} />
          </>
        )}
      </section>

      <PopularCard
        comics={rankedComics}
        period={rankingPeriod}
        onPeriodChange={setRankingPeriod}
        isLoading={isRankingLoading}
      />
    </div>
  );
}
