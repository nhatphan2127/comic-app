import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import type { FollowingComic, UserFollowingCategory } from '../../../../types/types';
import { comicApi, userApi } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { toggleArrayItem } from '../../../../helpers/utils';
import { ComicRow } from '../../../../components/FollowingComic/FollowingComic';
import Dropdown, { DropdownDivider, DropdownItem, MultiSelect } from '../../../../components/Dropdown/Dropdown';
import Pagination from '../../../../components/Pagination/Pagination';
import Segmented from '../../../../components/Segmented/Segmented';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import cx from '../../../../helpers/cx';
import {
  DEMOGRAPHIC_OPTIONS,
  EMPTY_FILTERS,
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  applyLibraryFilters,
  summarize,
  type LibraryFilters,
} from './libraryFilters';
import style from './FollowingTitlesPanel.module.css';

const PAGE_SIZE = 20;
type ListKey = 'types' | 'demographics' | 'statuses' | 'genres' | 'formats';

export default function FollowingTitlesPanel() {
  const [items, setItems] = useState<FollowingComic[]>([]);
  const [folders, setFolders] = useState<UserFollowingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [tagQuery, setTagQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([userApi.getFollowingList(), userApi.getFollowingCategories()])
      .then(([comics, categories]) => {
        setItems(comics || []);
        setFolders(categories || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your library'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setPage(1), [filters]);

  const setFilter = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const toggle = (key: ListKey, value: string) => setFilters((prev) => ({ ...prev, [key]: toggleArrayItem(prev[key], value) }));

  const visible = useMemo(() => applyLibraryFilters(items, filters), [items, filters]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ---------- Mutations ---------- */

  const toast = useToast();

  const unfollow = async (comicId: string) => {
    try {
      await comicApi.unfollow(comicId);
      setItems((prev) => prev.filter((i) => i.comic.id !== comicId));
    } catch (err) {
      toast.error(err, 'Failed to unfollow comic. Please try again.');
    }
  };

  const addFolder = async () => {
    const name = window.prompt('Folder name')?.trim();
    if (!name) return;
    try {
      const created = await userApi.createFollowingCategory(name);
      setFolders((prev) => [...prev, created]);
    } catch (err) {
      toast.error(err, 'Unable to add folder.');
    }
  };

  const renameFolder = async (folder: UserFollowingCategory) => {
    const name = window.prompt('Rename folder', folder.category)?.trim();
    if (!name) return;
    try {
      const updated = await userApi.updateFollowingCategory(folder.id, name);
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, category: updated.category } : f)));
    } catch (err) {
      toast.error(err, 'Unable to rename folder.');
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!window.confirm('Delete this folder? Titles in it stay in your library.')) return;
    try {
      await userApi.deleteFollowingCategory(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setItems((prev) => prev.map((i) => (i.category?.id === folderId ? { ...i, category: null } : i)));
      if (filters.folderId === folderId) setFilter('folderId', null);
    } catch (err) {
      toast.error(err, 'Unable to delete folder.');
    }
  };

  const moveToFolder = async (comicId: string, categoryId: string | null) => {
    try {
      await userApi.updateFollowingComicCategory(comicId, categoryId);
      const folder = folders.find((f) => f.id === categoryId) ?? null;
      setItems((prev) => prev.map((i) => (i.comic.id === comicId ? { ...i, category: folder } : i)));
    } catch (err) {
      toast.error(err, 'Unable to move title.');
    }
  };

  /* ---------- Render ---------- */

  const tagSearch = tagQuery.trim().toLowerCase();
  const tagGroups: { key: 'genres' | 'formats'; title: string; options: readonly string[] }[] = [
    { key: 'genres', title: 'Genres', options: GENRE_OPTIONS },
    { key: 'formats', title: 'Formats', options: FORMAT_OPTIONS },
  ];

  return (
    <PanelShell
      title="Following"
      subtitle={`${visible.length} ${visible.length === 1 ? 'title' : 'titles'} in your library`}
      actions={
        <Dropdown
          align="right"
          width={260}
          trigger={
            <>
              <Pencil size={14} /> Manage folders
            </>
          }
          triggerClassName="btn btn--ghost btn--sm"
        >
          {(close) => (
            <>
              {folders.map((folder) => (
                <div key={folder.id} className={style.folderRow}>
                  <span>{folder.category}</span>
                  <button type="button" aria-label={`Rename ${folder.category}`} onClick={() => void renameFolder(folder)}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" aria-label={`Delete ${folder.category}`} className={style.folderDelete} onClick={() => void deleteFolder(folder.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {folders.length ? <DropdownDivider /> : null}
              <DropdownItem
                icon={<Plus size={14} />}
                onClick={() => {
                  close();
                  void addFolder();
                }}
              >
                New folder
              </DropdownItem>
            </>
          )}
        </Dropdown>
      }
    >
      {folders.length > 0 ? (
        <Segmented
          ariaLabel="Folder"
          className={style.folders}
          value={filters.folderId ?? '__all'}
          onChange={(v) => setFilter('folderId', v === '__all' ? null : v)}
          options={[{ value: '__all', label: 'All' }, ...folders.map((f) => ({ value: f.id, label: f.category }))]}
        />
      ) : null}

      <div className={style.filters}>
        <div className={style.searchRow}>
          <label className={style.search}>
            <Search size={15} />
            <input
              type="search"
              placeholder="Search your library…"
              value={filters.query}
              onChange={(e) => setFilter('query', e.target.value)}
            />
          </label>
          <button type="button" className="btn btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <div className={style.filterGrid}>
          <Dropdown label="Sort by" value={SORT_OPTIONS.find((o) => o.key === filters.sort)?.label}>
            {(close) =>
              SORT_OPTIONS.map((opt) => (
                <DropdownItem
                  key={opt.key}
                  kind="radio"
                  selected={filters.sort === opt.key}
                  onClick={() => {
                    setFilter('sort', opt.key);
                    close();
                  }}
                >
                  {opt.label}
                </DropdownItem>
              ))
            }
          </Dropdown>

          <MultiSelect label="Type" options={TYPE_OPTIONS} selected={filters.types} summary={summarize(filters.types)} onToggle={(v) => toggle('types', v)} />

          <Dropdown label="Genres & formats" value={summarize([...filters.genres, ...filters.formats])} width={360}>
            {() => (
              <div className={style.tagPicker}>
                <div className={style.tagTools}>
                  <Segmented
                    ariaLabel="Match mode"
                    value={filters.matchAll ? 'all' : 'any'}
                    onChange={(v) => setFilter('matchAll', v === 'all')}
                    options={[
                      { value: 'all', label: 'Match all' },
                      { value: 'any', label: 'Match any' },
                    ]}
                  />
                  <input
                    className="input"
                    placeholder="Filter tags…"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                  />
                </div>
                {tagGroups.map(({ key, title, options }) => {
                  const shown = options.filter((o) => o.toLowerCase().includes(tagSearch));
                  return shown.length ? (
                    <section key={key}>
                      <h4 className={style.tagHeading}>{title}</h4>
                      <div className={style.tags}>
                        {shown.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={cx(style.tag, filters[key].includes(tag) && style.tagOn)}
                            aria-pressed={filters[key].includes(tag)}
                            onClick={() => toggle(key, tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null;
                })}
              </div>
            )}
          </Dropdown>

          <MultiSelect label="Demographic" options={DEMOGRAPHIC_OPTIONS} selected={filters.demographics} summary={summarize(filters.demographics)} onToggle={(v) => toggle('demographics', v)} />
          <MultiSelect label="Status" options={STATUS_OPTIONS} selected={filters.statuses} summary={summarize(filters.statuses)} onToggle={(v) => toggle('statuses', v)} />
        </div>
      </div>

      <PanelState
        loading={loading}
        loadingText="Loading your library…"
        error={error}
        empty={pageItems.length === 0}
        emptyTitle={items.length ? 'No matches' : 'Your library is empty'}
        emptyText={items.length ? 'Try loosening your filters.' : 'Follow a series and it will show up here.'}
      >
        <ul className={style.list}>
          {pageItems.map((item) => (
            <ComicRow
              key={item.comic.id}
              comic={item.comic}
              categoryId={item.category?.id ?? null}
              categoryName={item.category?.category}
              readChapters={item.readedChapter}
              unreadChapters={item.unreadChapters}
              latestChapterAt={item.latestChapterAt}
              totalChapters={item.totalChapters}
              categories={folders}
              onUnfollow={unfollow}
              onMoveCategory={moveToFolder}
            />
          ))}
        </ul>
        <Pagination currentPage={page} totalPages={pageCount} onPageChange={setPage} />
      </PanelState>
    </PanelShell>
  );
}
