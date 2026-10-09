import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../../services/api';
import type { Comment } from '../../../types/types';
import { useToast } from '../../../context/ToastContext';
import { formatTimeAgo } from '../../../helpers/formatDate';
import Segmented from '../../../components/Segmented/Segmented';
import Pagination from '../../../components/Pagination/Pagination';
import Page, { PageState } from '../../../console/ui/Page';
import { SearchField, Toolbar } from '../../../console/ui/Toolbar';
import ManageRow, { ManageList, StateSelect } from '../../../console/ui/ManageRow';
import useQueryState from '../../../console/useQueryState';

const PAGE_SIZE = 15;
type Filter = 'all' | 'visible' | 'banned';

/** /admin/comments: the latest comments; ban the ones that break the rules. */
export default function CommentsModule() {
  const toast = useToast();
  const [query, setQuery] = useQueryState({ q: '', state: 'all', page: '1' });
  const state = query.state as Filter;
  const page = Number(query.page) || 1;

  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await adminApi.getDashboard()).comments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load comments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bannedCount = items.filter((c) => c.isBanned).length;
  const visible = useMemo(() => {
    const q = query.q.trim().toLowerCase();
    return items.filter((c) => (state === 'all' || Boolean(c.isBanned) === (state === 'banned')) && (!q || c.content.toLowerCase().includes(q)));
  }, [items, state, query.q]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleBan = async (c: Comment) => {
    const banned = !c.isBanned;
    try {
      await adminApi.toggleCommentBan(c.source ?? 'comic', c.id, banned);
      setItems((prev) => prev.map((i) => (i.id === c.id ? { ...i, isBanned: banned ? 1 : 0 } : i)));
      toast.success(banned ? 'Comment hidden from readers.' : 'Comment visible again.');
    } catch (err) {
      toast.error(err, 'Unable to update comment');
    }
  };

  return (
    <Page title="Comments" description="The most recent comments on comics and chapters. Banned comments are hidden from readers.">
      <Toolbar>
        <Segmented
          ariaLabel="State"
          value={state}
          onChange={(v) => setQuery({ state: v })}
          options={[
            { value: 'all', label: 'All', count: items.length },
            { value: 'visible', label: 'Visible', count: items.length - bannedCount },
            { value: 'banned', label: 'Banned', count: bannedCount },
          ]}
        />
        <SearchField value={query.q} onChange={(q) => setQuery({ q })} placeholder="Search comment text…" />
      </Toolbar>

      <PageState loading={loading} loadingText="Loading comments…" error={error} empty={pageItems.length === 0} emptyTitle="No comments found" emptyText="Try another filter or search.">
        <ManageList>
          {pageItems.map((c) => (
            <ManageRow
              key={c.id}
              title={c.content}
              meta={[
                <span key="src" className="badge">
                  {c.source === 'chapter' ? 'Chapter' : 'Comic'}
                </span>,
                <Link key="author" to={`/users/${c.userId}`}>
                  Author profile
                </Link>,
                formatTimeAgo(c.createdAt),
              ]}
              actions={
                <StateSelect
                  value={c.isBanned ? 'banned' : 'visible'}
                  options={[
                    { value: 'visible', label: 'Visible' },
                    { value: 'banned', label: 'Banned' },
                  ]}
                  onChange={() => void toggleBan(c)}
                />
              }
            />
          ))}
        </ManageList>
        <Pagination currentPage={page} totalPages={pageCount} onPageChange={(p) => setQuery({ page: String(p) })} />
      </PageState>
    </Page>
  );
}
