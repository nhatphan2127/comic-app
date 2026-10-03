import { useState, useEffect } from 'react';
import type { Comic } from '../../types/types';
import ComicCardList from '../../components/ComicCard/ComicCard';
import Pagination from '../../components/Pagination/Pagination';
import PopularCard from '../../components/PopularCard/PopularCard';
import styles from './MainLayout.module.css';
import { comicApi, getStoredContentFilter, type ContentFilter } from '../../services/api';
import { LayoutGrid, List } from 'lucide-react';

export default function MainLayout() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [comics, setComics] = useState<Comic[]>([]);
  const [popularComics, setPopularComics] = useState<Comic[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>(() => getStoredContentFilter());

  // Fetch standard comics on page change
  useEffect(() => {
    let cancelled = false;

    const fetchComics = async () => {
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsChangingPage(true);
      }
      setError(null);

      try {
        const data = await comicApi.list(page, contentFilter);
        if (!cancelled) {
          setComics(data.comics || []);
          const totalPagesFromApi = data.metadata?.totalPages || 1;
          setTotalPages(Math.max(1, totalPagesFromApi));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'An error occurred while connecting to the server';
          setError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsChangingPage(false);
        }
      }
    };

    fetchComics();
    return () => {
      cancelled = true;
    };
  }, [page, contentFilter]);

  useEffect(() => {
    let cancelled = false;

    const fetchPopularComics = async () => {
      try {
        const data = await comicApi.getPopular(contentFilter);
        if (!cancelled) {
          setPopularComics(data || []);
        }
      } catch (err) {
        console.error('Could not fetch the popular comic list:', err);
      }
    };

    fetchPopularComics();
    return () => {
      cancelled = true;
    };
  }, [contentFilter]);

  useEffect(() => {
    const handleFilterChanged = () => {
      setContentFilter(getStoredContentFilter());
    };

    window.addEventListener('content-filter-changed', handleFilterChanged);
    window.addEventListener('storage', handleFilterChanged);

    return () => {
      window.removeEventListener('content-filter-changed', handleFilterChanged);
      window.removeEventListener('storage', handleFilterChanged);
    };
  }, []);

  return (
    <div className={styles['main-layout-container']}>
      <div className={styles['main-content-column']}>

        {/* SECTION: LAST UPDATE */}
        <section className={styles['manga-section']}>
          <div className={styles['main-section-header']}>
            <div className={styles['section-title-left']}>
              <h2>Last update</h2>
            </div>

            {/* View Mode Switcher */}
            <div className={styles['view-mode-toggle']}>
              <button
                className={`${styles['tab-btn']} ${viewMode === 'grid' ? styles['active'] : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid size={18} strokeWidth={2} />
              </button>

              <button
                className={`${styles['tab-btn']} ${viewMode === 'list' ? styles['active'] : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="List view"
              >
                <List size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {isLoading && comics.length === 0 ? (
            <div className={styles['loading-container']}>
              <p>Loading comics...</p>
            </div>
          ) : error ? (
            <div className={styles['error-container']}>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div className={styles['content-shell']}>
                <ComicCardList comics={comics} viewMode={viewMode} />
                {isChangingPage && (
                  <div className={styles['page-loading-overlay']}>
                    <p>Đang tải trang mới...</p>
                  </div>
                )}
              </div>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                isLoading={isChangingPage}
              />
            </>
          )}
        </section>
      </div>

      <PopularCard popularComics={popularComics} />
    </div>
  );
}