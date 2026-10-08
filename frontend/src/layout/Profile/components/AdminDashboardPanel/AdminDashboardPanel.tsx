import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { adminApi, chapterApi, moderationApi } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import type { AdminUser, Chapter, ChapterDetail, Comic, ComicDetail, Comment, UserRole } from '../../../../types/types';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import Segmented from '../../../../components/Segmented/Segmented';
import Pagination from '../../../../components/Pagination/Pagination';
import { ChapterPreviewModal, ComicPreviewModal } from '../../../../components/SubmissionPreview/SubmissionPreview';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import ManageRow, { ManageList, StateSelect } from '../ManageRow/ManageRow';
import cx from '../../../../helpers/cx';
import style from './AdminDashboardPanel.module.css';

type Tab = 'user' | 'comment' | 'comic' | 'chapter';
/** "on" = active / public, "off" = banned / hidden. */
type Filter = 'all' | 'on' | 'off';
type Visibility = 'public' | 'hidden';

const PAGE_SIZE = 12;

const TABS: { value: Tab; label: string }[] = [
  { value: 'user', label: 'Users' },
  { value: 'comment', label: 'Comments' },
  { value: 'comic', label: 'Comics' },
  { value: 'chapter', label: 'Chapters' },
];

const FILTER_LABELS: Record<Tab, { on: string; off: string }> = {
  user: { on: 'Active', off: 'Banned' },
  comment: { on: 'Visible', off: 'Banned' },
  comic: { on: 'Public', off: 'Hidden' },
  chapter: { on: 'Public', off: 'Hidden' },
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
];

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'hidden', label: 'Hidden' },
];

type Row = AdminUser | Comment | Comic | Chapter;

/** Whether an item is in its "on" state for the given tab. */
const isOn = (tab: Tab, item: Row) =>
  tab === 'user' || tab === 'comment' ? !(item as AdminUser | Comment).isBanned : (item as Comic | Chapter).visibility === 'public';

const matches = (tab: Tab, item: Row, q: string) => {
  switch (tab) {
    case 'user': {
      const u = item as AdminUser;
      return `${u.username} ${u.displayName ?? ''}`.toLowerCase().includes(q);
    }
    case 'comment':
      return ((item as Comment).content || '').toLowerCase().includes(q);
    case 'comic':
      return ((item as Comic).name || '').toLowerCase().includes(q);
    case 'chapter': {
      const c = item as Chapter;
      return (c.title || '').toLowerCase().includes(q) || String(c.chapterNumber).includes(q);
    }
  }
};

export default function AdminDashboardPanel() {
  const { user, isLoggedIn } = useAuth();
  const canManage = isLoggedIn && (user?.role || '').toLowerCase() === 'admin';

  const [tab, setTab] = useState<Tab>('user');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Record<Tab, Row[]>>({ user: [], comment: [], comic: [], chapter: [] });
  const [autoAccept, setAutoAccept] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comicPreview, setComicPreview] = useState<{ open: boolean; data: ComicDetail | null }>({ open: false, data: null });
  const [chapterPreview, setChapterPreview] = useState<{ open: boolean; data: ChapterDetail | null }>({ open: false, data: null });

  const load = useCallback(async () => {
    if (!canManage) {
      setError('Please sign in as an admin to access the dashboard.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [dashboard, comics, chapters] = await Promise.all([adminApi.getDashboard(), adminApi.getComics(), adminApi.getChapters()]);
      setData({ user: dashboard?.users || [], comment: dashboard?.comments || [], comic: comics || [], chapter: chapters || [] });
      setAutoAccept(Boolean(dashboard?.autoAccept));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [tab, filter, query]);

  /** Runs an admin mutation, then reloads the dashboard. */
  const run = (action: () => Promise<unknown>, failMessage: string) => async () => {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : failMessage);
    }
  };

  const toggleAutoAccept = async () => {
    try {
      const res = await adminApi.setAutoAccept(!autoAccept);
      setAutoAccept(Boolean(res.enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update auto-accept');
    }
  };

  const items = data[tab];
  const onCount = items.filter((i) => isOn(tab, i)).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (filter === 'all' || isOn(tab, i) === (filter === 'on')) && (!q || matches(tab, i, q)));
  }, [items, filter, query, tab]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openComic = async (comic: Comic) => {
    setComicPreview({ open: true, data: null });
    try {
      // The staff endpoint also returns hidden and pending comics, which the public one 404s on.
      setComicPreview({ open: true, data: await moderationApi.getComicDetail(comic.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load comic');
      setComicPreview({ open: false, data: null });
    }
  };

  const openChapter = async (chapter: Chapter) => {
    setChapterPreview({ open: true, data: null });
    try {
      setChapterPreview({ open: true, data: await chapterApi.getDetails(chapter.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load chapter');
      setChapterPreview({ open: false, data: null });
    }
  };

  const renderRow = (item: Row) => {
    switch (tab) {
      case 'user': {
        const u = item as AdminUser;
        const banned = Boolean(u.isBanned);
        return (
          <ManageRow
            key={u.id}
            title={u.displayName || u.username}
            meta={[`@${u.username}`, u.createdAt ? `Joined ${formatTimeAgo(u.createdAt)}` : null]}
            actions={
              <>
                <StateSelect
                  value={u.role ?? 'user'}
                  options={ROLE_OPTIONS}
                  onChange={(role) => run(() => adminApi.setUserRole(u.id, role), 'Unable to change role')()}
                />
                <StateSelect
                  value={banned ? 'banned' : 'active'}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'banned', label: 'Banned' },
                  ]}
                  onChange={run(() => adminApi.toggleUserBan(u.id, !banned), 'Unable to update user')}
                />
              </>
            }
          />
        );
      }
      case 'comment': {
        const c = item as Comment;
        const banned = Boolean(c.isBanned);
        return (
          <ManageRow
            key={c.id}
            title={c.content}
            meta={[<span key="src" className="badge">{c.source === 'comic' ? 'Comic' : 'Chapter'}</span>, formatTimeAgo(c.createdAt)]}
            actions={
              <StateSelect
                value={banned ? 'banned' : 'visible'}
                options={[
                  { value: 'visible', label: 'Visible' },
                  { value: 'banned', label: 'Banned' },
                ]}
                onChange={run(() => adminApi.toggleCommentBan(c.source ?? 'comic', c.id, !banned), 'Unable to update comment')}
              />
            }
          />
        );
      }
      case 'comic': {
        const c = item as Comic;
        return (
          <ManageRow
            key={c.id}
            cover={c.coverUrl}
            title={c.name}
            meta={[formatTimeAgo(c.updatedAt)]}
            actions={
              <>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void openComic(c)}>
                  <Eye size={14} />
                  Preview
                </button>
                <StateSelect
                  value={(c.visibility ?? 'public') as Visibility}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => run(() => adminApi.updateComicVisibility(c.id, v), 'Unable to update comic')()}
                />
              </>
            }
          />
        );
      }
      case 'chapter': {
        const c = item as Chapter;
        return (
          <ManageRow
            key={c.id}
            title={`Chapter ${c.chapterNumber}${c.title ? ` · ${c.title}` : ''}`}
            meta={[formatTimeAgo(c.updatedAt)]}
            actions={
              <>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void openChapter(c)}>
                  <Eye size={14} />
                  Preview
                </button>
                <StateSelect
                  value={(c.visibility ?? 'public') as Visibility}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => run(() => adminApi.updateChapterVisibility(c.id, v), 'Unable to update chapter')()}
                />
              </>
            }
          />
        );
      }
    }
  };

  return (
    <PanelShell title="Admin dashboard" subtitle="Manage users, comments and content visibility.">
      <label className={style.autoAccept}>
        <span>
          <strong>Auto-approve submissions</strong>
          <small>New comics and chapters go live without manual review.</small>
        </span>
        <input type="checkbox" className="sr-only" checked={autoAccept} onChange={toggleAutoAccept} />
        <span className={cx(style.switch, autoAccept && style.switchOn)} aria-hidden="true" />
      </label>

      <div className={style.toolbar}>
        <Segmented
          ariaLabel="Section"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setFilter('all');
            setQuery('');
          }}
          options={TABS.map((t) => ({ ...t, count: data[t.value].length }))}
        />
        <Segmented
          ariaLabel="State"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'on', label: FILTER_LABELS[tab].on, count: onCount },
            { value: 'off', label: FILTER_LABELS[tab].off, count: items.length - onCount },
          ]}
        />
      </div>

      <label className={style.search}>
        <Search size={15} />
        <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <PanelState loading={loading} loadingText="Loading dashboard…" error={error} empty={pageItems.length === 0} emptyTitle="Nothing found" emptyText="Try another filter or search.">
        <ManageList>{pageItems.map(renderRow)}</ManageList>
        <Pagination currentPage={page} totalPages={pageCount} onPageChange={setPage} />
      </PanelState>

      <ComicPreviewModal isOpen={comicPreview.open} data={comicPreview.data} loading={!comicPreview.data} onClose={() => setComicPreview({ open: false, data: null })} />
      <ChapterPreviewModal isOpen={chapterPreview.open} data={chapterPreview.data} loading={!chapterPreview.data} onClose={() => setChapterPreview({ open: false, data: null })} />
    </PanelShell>
  );
}
