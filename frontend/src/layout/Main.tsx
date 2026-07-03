import { useState, useEffect } from 'react';
import type { Comic } from '../types/data';
import ComicCardList from '../components/ComicCard';
import Pagination from '../components/Pagination';
import PopularCard from '../components/PopularCard';
import '../assets/styles/Main.css';

// Import the configured comicApi
import { comicApi } from '../services/api'; // Adjust the import path as needed

// Import icons from lucide-react
import { Clock, LayoutGrid, List } from 'lucide-react';
export default function Main() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [comics, setComics] = useState<Comic[]>([]);
  const [popularComics, setPopularComics] = useState<Comic[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsPerPage = 12;

  // Fetch standard comics on page change using comicApi
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
        const data = await comicApi.list(page);
        if (!cancelled) {
          setComics(data.comics || []);
          const totalPagesFromApi = data.pagination?.totalPages || 1;
          setTotalPages(Math.max(1, totalPagesFromApi));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'An error occurred while connecting to the server');
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
  }, [page, itemsPerPage]);

  // Fetch popular comics using comicApi
  useEffect(() => {
    const fetchPopularComics = async () => {
      try {
        const data = await comicApi.getPopular();
        setPopularComics(data || []);
      } catch (err) {
        console.error('Could not fetch the popular comic list:', err);
      }
    };

    fetchPopularComics();
  }, []);

  return (
    <div className="main-layout-container">
      {/* 1. LEFT CONTENT COLUMN */}
      <div className="main-content-column">

        {/* SECTION: LAST UPDATE */}
        <section className="manga-section">
          <div className="main-section-header">
            <div className="section-title-left">
              <Clock className="section-title-icon" strokeWidth={2.5} size={20} />
              <h2>Last update</h2>
            </div>

            {/* View Mode Switcher */}
            <div className="view-mode-toggle">
              <button
                className={`tab-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid size={18} strokeWidth={2} />
              </button>

              <button
                className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="List view"
              >
                <List size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {isLoading && comics.length === 0 ? (
            <div className="loading-container">
              <p>Loading comics...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div className="content-shell">
                <ComicCardList comics={comics} viewMode={viewMode} />
                {isChangingPage && (
                  <div className="page-loading-overlay">
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