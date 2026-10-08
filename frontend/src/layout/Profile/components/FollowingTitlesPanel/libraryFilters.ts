import type { FollowingComic } from '../../../../types/types';
import { parseServerDate } from '../../../../helpers/formatDate';

export {
  DEMOGRAPHIC_OPTIONS,
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '../../../../constants/comicOptions';

export type SortKey =
  | 'unread_desc'
  | 'updated_desc' | 'updated_asc'
  | 'added_desc' | 'added_asc'
  | 'read_desc' | 'read_asc'
  | 'title_asc' | 'title_desc'
  | 'year_desc' | 'year_asc'
  | 'score_desc' | 'score_asc';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'unread_desc', label: 'New chapters first' },
  { key: 'updated_desc', label: 'Recently updated' },
  { key: 'updated_asc', label: 'Least recently updated' },
  { key: 'added_desc', label: 'Recently added' },
  { key: 'added_asc', label: 'Oldest added' },
  { key: 'read_desc', label: 'Recently read' },
  { key: 'read_asc', label: 'Least recently read' },
  { key: 'title_asc', label: 'Title A → Z' },
  { key: 'title_desc', label: 'Title Z → A' },
  { key: 'year_desc', label: 'Year (newest)' },
  { key: 'year_asc', label: 'Year (oldest)' },
  { key: 'score_desc', label: 'Score (high → low)' },
  { key: 'score_asc', label: 'Score (low → high)' },
];

export interface LibraryFilters {
  query: string;
  folderId: string | null;
  types: string[];
  demographics: string[];
  statuses: string[];
  genres: string[];
  formats: string[];
  matchAll: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: LibraryFilters = {
  query: '',
  folderId: null,
  types: [],
  demographics: [],
  statuses: [],
  genres: [],
  formats: [],
  matchAll: true,
  sort: 'unread_desc',
};

const lower = (v: unknown) => String(v ?? '').toLowerCase();
const squash = (v: unknown) => lower(v).replace(/\s+/g, '');
const names = (list: unknown): string[] =>
  Array.isArray(list) ? list.map((x) => lower(typeof x === 'string' ? x : (x as { name?: string })?.name)) : [];
const time = (d?: string | null) => (d ? parseServerDate(d).getTime() : 0);
const title = (item: FollowingComic) => item.comic.name || '';

type Getter = (item: FollowingComic) => number | string;
const SORT_FIELDS: Record<string, Getter> = {
  // Titles with unread chapters first; among them (and the rest) the most recently updated.
  unread: (i) => (i.unreadChapters > 0 ? 1e13 : 0) + time(i.latestChapterAt),
  updated: (i) => time(i.latestChapterAt || i.comic.updatedAt),
  added: (i) => time(i.followedAt || i.updatedAt),
  read: (i) => time(i.lastReadAt),
  title,
  year: (i) => Number(i.comic.releasingYear || 0),
  score: (i) => Number(i.comic.rating || 0),
};

/** Applies all library filters and the chosen sort. */
export function applyLibraryFilters(items: FollowingComic[], f: LibraryFilters): FollowingComic[] {
  const q = f.query.trim().toLowerCase();
  const wanted = [...f.genres, ...f.formats].map(lower);

  const result = items.filter((item) => {
    const c = item.comic;
    if (q && !lower(c.name).includes(q)) return false;
    if (f.folderId && item.category?.id !== f.folderId) return false;
    if (f.types.length && !f.types.some((t) => lower(t) === lower(c.types))) return false;
    if (f.demographics.length && !f.demographics.some((d) => lower(d) === lower(c.demographic))) return false;
    if (f.statuses.length && !f.statuses.some((s) => squash(s) === squash(c.releaseStatus))) return false;

    if (wanted.length) {
      const have = new Set([...names(c.genres), ...names(c.formats)]);
      const hits = wanted.filter((w) => have.has(w)).length;
      if (f.matchAll ? hits !== wanted.length : hits === 0) return false;
    }
    return true;
  });

  const [field, dir] = f.sort.split('_') as [string, 'asc' | 'desc'];
  const get = SORT_FIELDS[field] ?? title;
  const sign = dir === 'asc' ? 1 : -1;

  return result.sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const primary = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
    return sign * primary || title(a).localeCompare(title(b));
  });
}

export const summarize = (selected: string[]) =>
  selected.length === 0 ? 'Any' : selected.length <= 2 ? selected.join(', ') : `${selected.length} selected`;
