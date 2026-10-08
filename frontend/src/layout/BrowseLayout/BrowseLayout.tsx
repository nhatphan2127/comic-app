import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Comic } from '../../types/types';
import ComicCardList from '../../components/ComicCard/ComicCard';
import Pagination from '../../components/Pagination/Pagination';
import { comicApi } from '../../services/api';
import { DEMOGRAPHIC_OPTIONS, FORMAT_OPTIONS, GENRE_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from '../../constants/comicOptions';
import useContentFilter from '../../hooks/useContentFilter';
import cx from '../../helpers/cx';
import styles from './BrowseLayout.module.css';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: '-updatedAt', label: 'Recently updated' },
  { value: '-createdAt', label: 'Newest' },
  { value: '-view', label: 'Most viewed' },
  { value: '-follow', label: 'Most followed' },
  { value: '-rating', label: 'Top rated' },
  { value: 'name', label: 'Title A–Z' },
];

/** Every filter lives in the URL, so a filtered view can be shared or bookmarked. */
const FILTER_KEYS = ['search', 'type', 'demographic', 'status', 'genre', 'format', 'sort', 'page'] as const;

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <label className={styles.select}>
      <span>{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o.toLowerCase()}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function BrowseLayout() {
  const contentFilter = useContentFilter();
  const [params, setParams] = useSearchParams();

  const search = params.get('search') ?? '';
  const type = params.get('type') ?? '';
  const demographic = params.get('demographic') ?? '';
  const status = params.get('status') ?? '';
  const genres = (params.get('genre') ?? '').split(',').filter(Boolean);
  const formats = (params.get('format') ?? '').split(',').filter(Boolean);
  const sort = params.get('sort') || SORT_OPTIONS[0].value;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [draft, setDraft] = useState(search);
  const [showGenres, setShowGenres] = useState(genres.length + formats.length > 0);
  const [comics, setComics] = useState<Comic[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The header search can change ?search= while this page is open.
  useEffect(() => setDraft(search), [search]);

  const genreKey = genres.join(',');
  const formatKey = formats.join(',');
  // Opening a link with ?genre= or ?format= (e.g. from a comic page) shows the chips it selected.
  useEffect(() => {
    if (genreKey || formatKey) setShowGenres(true);
  }, [genreKey, formatKey]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    comicApi
      .browse(
        {
          q: search,
          type,
          demographic,
          releaseStatus: status,
          genres: genreKey ? genreKey.split(',') : [],
          formats: formatKey ? formatKey.split(',') : [],
          sort,
          page,
          pageSize: PAGE_SIZE,
        },
        contentFilter,
      )
      .then(({ comics: items, meta }) => {
        if (cancelled) return;
        setComics(items || []);
        setTotalItems(meta?.totalItems ?? 0);
        setTotalPages(Math.max(1, meta?.totalPages || 1));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not connect to the server');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, type, demographic, status, genreKey, formatKey, sort, page, contentFilter]);

  /** Updates some filters and goes back to page 1 (unless the page itself is what changed). */
  const update = (changes: Partial<Record<(typeof FILTER_KEYS)[number], string>>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      if (!('page' in changes)) next.delete('page');
      return next;
    });
  };

  const toggleIn = (param: 'genre' | 'format', current: string[], value: string) => {
    const key = value.toLowerCase();
    const next = current.includes(key) ? current.filter((v) => v !== key) : [...current, key];
    update({ [param]: next.join(',') });
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    update({ search: draft.trim() });
  };

  const changePage = (next: number) => {
    update({ page: String(next) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeCount = [search, type, demographic, status].filter(Boolean).length + genres.length + formats.length;
  const clearAll = () => setParams(sort !== SORT_OPTIONS[0].value ? { sort } : {});

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Browse</h1>
          <p className={styles.subtitle}>
            {isLoading ? 'Searching…' : `${totalItems} ${totalItems === 1 ? 'title' : 'titles'}`}
            {search ? ` matching “${search}”` : ''}
          </p>
        </div>

        <form className={styles.search} onSubmit={submitSearch} role="search">
          <Search size={16} />
          <input type="search" placeholder="Title or alternative name…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Search titles" />
          <button type="submit" className="btn btn--primary btn--sm">
            Search
          </button>
        </form>
      </header>

      <section className={styles.filters} aria-label="Filters">
        <div className={styles.selects}>
          <FilterSelect label="Type" value={type} options={TYPE_OPTIONS} onChange={(v) => update({ type: v })} />
          <FilterSelect label="Demographic" value={demographic} options={DEMOGRAPHIC_OPTIONS} onChange={(v) => update({ demographic: v })} />
          <FilterSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={(v) => update({ status: v })} />
          <label className={styles.select}>
            <span>Sort by</span>
            <select className="input" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.filterBar}>
          <button type="button" className="btn btn--ghost btn--sm" aria-expanded={showGenres} onClick={() => setShowGenres((v) => !v)}>
            <SlidersHorizontal size={14} />
            Genres & formats{genres.length + formats.length ? ` (${genres.length + formats.length})` : ''}
          </button>
          {activeCount > 0 ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearAll}>
              <X size={14} />
              Clear filters
            </button>
          ) : null}
        </div>

        {showGenres
          ? ([
              ['Genres', 'genre', GENRE_OPTIONS, genres],
              ['Formats', 'format', FORMAT_OPTIONS, formats],
            ] as const).map(([label, param, options, selected]) => (
              <div key={param} className={styles.chipGroup}>
                <span className={styles.chipLabel}>{label}</span>
                <div className={styles.genres}>
                  {options.map((option) => {
                    const on = selected.includes(option.toLowerCase());
                    return (
                      <button
                        key={option}
                        type="button"
                        className={cx('chip', styles.genre, on && styles.genreOn)}
                        aria-pressed={on}
                        onClick={() => toggleIn(param, selected, option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          : null}
      </section>

      {error ? (
        <p className={cx(styles.state, styles.stateError)}>{error}</p>
      ) : !isLoading && comics.length === 0 ? (
        <div className={styles.state}>
          <strong>No titles found</strong>
          <p>Try fewer filters or a different search.</p>
        </div>
      ) : (
        <>
          <div className={cx(styles.results, isLoading && styles.resultsLoading)} aria-busy={isLoading}>
            <ComicCardList comics={comics} viewMode="grid" />
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={changePage} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
