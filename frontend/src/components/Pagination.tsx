interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export default function Pagination({ currentPage, totalPages, onPageChange, isLoading = false }: PaginationProps) {
  const getPageNumbers = () => {
    const maxVisible = window.innerWidth < 480 ? 3 : window.innerWidth < 768 ? 5 : 7;
    const halfVisible = Math.floor(maxVisible / 2);
    
    let start = Math.max(1, currentPage - halfVisible);
    let end = Math.min(totalPages, currentPage + halfVisible);
    
    if (start === 1) {
      end = Math.min(totalPages, end + (maxVisible - (end - start + 1)));
    }
    if (end === totalPages) {
      start = Math.max(1, start - (maxVisible - (end - start + 1)));
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const pageNumbers = getPageNumbers();

  const handlePageChange = (pageNumber: number) => {
    if (isLoading || pageNumber === currentPage) {
      return;
    }

    onPageChange(pageNumber);
  };

  return (
    <div className="pagination-container">
      <div className="pagination-inner">
        <button
          className={`pagination-btn pagination-prev ${currentPage === 1 || isLoading ? 'disabled' : ''}`}
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1 || isLoading}
          aria-label="Previous page"
          title="Go to previous page"
        >
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {pageNumbers[0] > 1 && (
          <>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(1)}
              aria-label="Go to page 1"
            >
              1
            </button>
            {pageNumbers[0] > 2 && (
              <span style={{ padding: '0 0.25rem', color: 'var(--text-3)' }}>...</span>
            )}
          </>
        )}

        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            className={`pagination-btn page-number ${currentPage === pageNumber ? 'active' : ''}`}
            onClick={() => handlePageChange(pageNumber)}
            aria-label={`Page ${pageNumber}`}
            aria-current={currentPage === pageNumber ? 'page' : undefined}
            disabled={isLoading}
          >
            {pageNumber}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span style={{ padding: '0 0.25rem', color: 'var(--text-3)' }}>...</span>
            )}
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(totalPages)}
              aria-label={`Go to page ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          className={`pagination-btn pagination-next ${currentPage === totalPages || isLoading ? 'disabled' : ''}`}
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages || isLoading}
          aria-label="Next page"
          title="Go to next page"
        >
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}