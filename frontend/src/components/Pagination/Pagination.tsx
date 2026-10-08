import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import cx from '../../helpers/cx';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const visibleCountFor = (width: number) => (width < 480 ? 3 : width < 768 ? 5 : 7);

/** Window of page numbers centred on the current page, clamped to [1, total]. */
function getPageWindow(current: number, total: number, size: number): number[] {
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function Pagination({ currentPage, totalPages, onPageChange, isLoading = false }: PaginationProps) {
  const [visibleCount, setVisibleCount] = useState(() => visibleCountFor(window.innerWidth));

  useEffect(() => {
    const onResize = () => setVisibleCount(visibleCountFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (totalPages <= 1) return null;

  const pages = getPageWindow(currentPage, totalPages, visibleCount);
  const first = pages[0];
  const last = pages[pages.length - 1];

  const go = (page: number) => {
    if (!isLoading && page !== currentPage && page >= 1 && page <= totalPages) onPageChange(page);
  };

  const pageButton = (page: number) => (
    <button
      key={page}
      type="button"
      className={cx(styles.btn, page === currentPage && styles.active, 'mono')}
      onClick={() => go(page)}
      disabled={isLoading}
      aria-label={`Page ${page}`}
      aria-current={page === currentPage ? 'page' : undefined}
    >
      {page}
    </button>
  );

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        type="button"
        className={styles.btn}
        onClick={() => go(currentPage - 1)}
        disabled={currentPage === 1 || isLoading}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {first > 1 ? pageButton(1) : null}
      {first > 2 ? <span className={styles.gap}>…</span> : null}
      {pages.map(pageButton)}
      {last < totalPages - 1 ? <span className={styles.gap}>…</span> : null}
      {last < totalPages ? pageButton(totalPages) : null}

      <button
        type="button"
        className={styles.btn}
        onClick={() => go(currentPage + 1)}
        disabled={currentPage === totalPages || isLoading}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
