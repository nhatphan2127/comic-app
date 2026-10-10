import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Star, X } from 'lucide-react';
import { comicApi, type ComicSearchResult } from '../../services/api';
import useClickOutside from '../../hooks/useClickOutside';
import useContentFilter from '../../hooks/useContentFilter';
import Cover from '../../components/Cover/Cover';
import { getImage } from '../../helpers/getImage';
import cx from '../../helpers/cx';
import styles from './HeaderLayout.module.css';

const SEARCH_DEBOUNCE_MS = 250;
// Same minimum as GET /comics/suggest, which answers [] below it.
const MIN_QUERY_LENGTH = 2;
const LISTBOX_ID = 'header-search-results';
const optionId = (index: number) => `${LISTBOX_ID}-${index}`;

export default function HeaderSearch() {
  const navigate = useNavigate();
  const contentFilter = useContentFilter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ComicSearchResult[]>([]);
  // Index of the suggestion picked with ↑/↓; -1 = none, so Enter searches the typed text.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const isLongEnough = trimmed.length >= MIN_QUERY_LENGTH;
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(formRef, close, isOpen);

  useEffect(() => {
    setActiveIndex(-1);
    if (!isLongEnough || !isOpen) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    // A newer keystroke cancels both the pending timer and the request already in flight.
    const controller = new AbortController();
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const data = await comicApi.suggest(trimmed, controller.signal, contentFilter);
        setResults(data);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Unable to load search results');
      }
      if (!controller.signal.aborted) setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isOpen, isLongEnough, trimmed, contentFilter]);

  const browseUrl = `/browse?search=${encodeURIComponent(trimmed)}`;

  const reset = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsOpen(false);
  };

  // Enter without a highlighted suggestion: the full results on the Browse page.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    navigate(browseUrl);
    setIsOpen(false);
  };

  const showsResults = isOpen && isLongEnough && !isSearching && !error && results.length > 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (isOpen) setIsOpen(false);
      else inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (!showsResults) return;
      e.preventDefault(); // keep the caret where it is
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // Wraps through "nothing selected" (-1) so the typed text can be searched again.
      setActiveIndex((current) => ((current + step + 1 + results.length + 1) % (results.length + 1)) - 1);
      return;
    }
    if (e.key === 'Enter' && showsResults && activeIndex >= 0) {
      e.preventDefault();
      navigate(`/comics/${results[activeIndex].url}`);
      reset();
    }
  };

  const renderResults = () => {
    if (!isLongEnough) {
      return <p className={styles.popEmpty}>Type at least {MIN_QUERY_LENGTH} characters…</p>;
    }

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
        <ul id={LISTBOX_ID} className={styles.resultList} role="listbox" aria-label="Suggestions">
          {results.map((result, index) => (
            <li key={result.id} id={optionId(index)} role="option" aria-selected={index === activeIndex}>
              <Link
                to={`/comics/${result.url}`}
                className={cx(styles.result, index === activeIndex && styles.resultActive)}
                onClick={reset}
                onMouseEnter={() => setActiveIndex(index)}
                tabIndex={-1}
              >
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
          ref={inputRef}
          type="search"
          placeholder="Search titles…"
          aria-label="Search comics"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showsResults}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={showsResults && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={query}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
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
          <div className={cx(styles.pop, styles.searchPop)}>
            <div className={styles.popLabel}>Results</div>
            {renderResults()}
          </div>
        ) : null}
      </form>
    </div>
  );
}
