import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Star, X } from 'lucide-react';
import { comicApi, type ComicSearchResult } from '../../services/api';
import useClickOutside from '../../hooks/useClickOutside';
import Cover from '../../components/Cover/Cover';
import { getImage } from '../../helpers/getImage';
import cx from '../../helpers/cx';
import styles from './HeaderLayout.module.css';

const SEARCH_DEBOUNCE_MS = 250;

export default function HeaderSearch() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ComicSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(formRef, close, isOpen);

  useEffect(() => {
    if (!trimmed || !isOpen) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    let ignore = false;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const data = await comicApi.search(trimmed);
        if (!ignore) {
          setResults(data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setResults([]);
          setError(err instanceof Error ? err.message : 'Unable to load search results');
        }
      } finally {
        if (!ignore) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, trimmed]);

  const browseUrl = `/browse?search=${encodeURIComponent(trimmed)}`;

  const reset = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsOpen(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    navigate(browseUrl);
    setIsOpen(false);
  };

  const renderResults = () => {
    if (isSearching) {
      return <p className={styles.popEmpty}>Searching…</p>;
    }

    if (error) {
      return (
        <div className={styles.popEmpty}>
          <strong>Unable to load results</strong>
          <span>{error}</span>
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className={styles.popEmpty}>
          <strong>No matches for “{trimmed}”</strong>
          <span>Try a different title.</span>
        </div>
      );
    }

    return (
      <>
        <ul className={styles.resultList}>
          {results.map((result) => (
            <li key={result.id}>
              <Link to={`/comics/${result.url}`} className={styles.result} onClick={reset}>
                <Cover src={getImage(result.coverUrl)} size="xs" />
                <span className={styles.resultBody}>
                  <span className={styles.resultTitle}>{result.name}</span>
                  <span className={styles.resultMeta}>
                    <span className={styles.typeTag}>{(result.types || 'Other').toUpperCase()}</span>
                    {result.latestChapter ? <span>Ch. {result.latestChapter}</span> : null}
                  </span>
                </span>
                {typeof result.rating === 'number' && result.rating > 0 ? (
                  <span className={cx(styles.resultRating, 'mono')}>
                    <Star size={12} />
                    {result.rating.toFixed(1)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
        <Link to={browseUrl} className={styles.popFooter} onClick={close}>
          <span>
            See all results for <strong>“{trimmed}”</strong>
          </span>
          <ArrowRight size={14} />
        </Link>
      </>
    );
  };

  return (
    <div className={cx(styles.search, isOpen && styles.searchOpen)}>
      <button
        type="button"
        className={cx(styles.iconBtn, styles.searchToggle)}
        aria-label="Open search"
        onClick={() => setIsOpen(true)}
      >
        <Search size={18} />
      </button>

      <form ref={formRef} className={styles.searchForm} onSubmit={handleSubmit} role="search">
        <Search className={styles.searchIcon} size={16} />
        <input
          type="search"
          placeholder="Search titles…"
          aria-label="Search comics"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
        />
        <Link to="/browse" className={styles.browseLink} title="Browse all titles">
          Browse
        </Link>
        <button type="button" className={styles.searchClose} aria-label="Close search" onClick={reset}>
          <X size={16} />
        </button>

        {isOpen && trimmed ? (
          <div className={cx(styles.pop, styles.searchPop)} role="listbox">
            <div className={styles.popLabel}>Results</div>
            {renderResults()}
          </div>
        ) : null}
      </form>
    </div>
  );
}
