import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../../services/api';
import type { AdminUser, UserRole } from '../../../types/types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { formatTimeAgo } from '../../../helpers/formatDate';
import { resolveUploadUrl } from '../../../helpers/getImage';
import Avatar from '../../../components/Avatar/Avatar';
import Segmented from '../../../components/Segmented/Segmented';
import Pagination from '../../../components/Pagination/Pagination';
import Page, { PageState } from '../../../console/ui/Page';
import { SearchField, Toolbar } from '../../../console/ui/Toolbar';
import ManageRow, { ManageList, StateSelect } from '../../../console/ui/ManageRow';
import useQueryState from '../../../console/useQueryState';

const PAGE_SIZE = 20;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'Reader' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
];

type RoleFilter = 'all' | UserRole;
type StateFilter = 'all' | 'active' | 'banned';

/** /admin/users: every account; change roles and bans. */
export default function UsersModule() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useQueryState({ q: '', role: 'all', state: 'all', page: '1' });
  const role = query.role as RoleFilter;
  const state = query.state as StateFilter;
  const page = Number(query.page) || 1;

  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState({ items: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi.listUsers({
        q: query.q.trim(),
        role: role === 'all' ? undefined : role,
        isBanned: state === 'all' ? undefined : state === 'banned',
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal({ items: res.meta.totalItems, pages: Math.max(1, res.meta.totalPages) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }, [query.q, role, state, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Update the row in place: reloading would reorder nothing and only cost a request.
  const patch = (id: string, changes: Partial<AdminUser>) => setItems((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)));

  const changeRole = async (u: AdminUser, next: UserRole) => {
    try {
      await adminApi.setUserRole(u.id, next);
      patch(u.id, { role: next });
      toast.success(`@${u.username} is now ${ROLE_OPTIONS.find((r) => r.value === next)?.label.toLowerCase()}.`);
    } catch (err) {
      toast.error(err, 'Unable to change role');
    }
  };

  const toggleBan = async (u: AdminUser) => {
    const banned = !u.isBanned;
    if (banned && !window.confirm(`Ban @${u.username}? They will be signed out and cannot sign in again.`)) return;
    try {
      await adminApi.toggleUserBan(u.id, banned);
      patch(u.id, { isBanned: banned ? 1 : 0 });
      toast.success(banned ? `@${u.username} was banned.` : `@${u.username} was unbanned.`);
    } catch (err) {
      toast.error(err, 'Unable to update user');
    }
  };

  return (
    <Page title="Users" description={`${total.items} account${total.items === 1 ? '' : 's'}. Change roles or ban accounts. You cannot change your own.`}>
      <Toolbar>
        <Segmented
          ariaLabel="Role"
          value={role}
          onChange={(v) => setQuery({ role: v })}
          options={[{ value: 'all' as RoleFilter, label: 'All' }, ...ROLE_OPTIONS.map((r) => ({ value: r.value as RoleFilter, label: `${r.label}s` }))]}
        />
        <Segmented
          ariaLabel="State"
          value={state}
          onChange={(v) => setQuery({ state: v })}
          options={[
            { value: 'all', label: 'Any state' },
            { value: 'active', label: 'Active' },
            { value: 'banned', label: 'Banned' },
          ]}
        />
        <SearchField value={query.q} onChange={(q) => setQuery({ q })} placeholder="Search name, username or email…" debounceMs={300} />
      </Toolbar>

      <PageState loading={loading} loadingText="Loading users…" error={error} empty={items.length === 0} emptyTitle="No users found" emptyText="Try another filter or search.">
        <ManageList>
          {items.map((u) => {
            const isMe = u.id === me?.id;
            const banned = Boolean(u.isBanned);
            return (
              <ManageRow
                key={u.id}
                leading={<Avatar name={u.displayName || u.username} src={resolveUploadUrl(u.avatar)} size={40} />}
                title={
                  <Link to={`/users/${u.id}`}>
                    {u.displayName || u.username}
                    {isMe ? ' (you)' : ''}
                  </Link>
                }
                meta={[
                  `@${u.username}`,
                  u.email ?? null,
                  u.createdAt ? `Joined ${formatTimeAgo(u.createdAt)}` : null,
                  banned ? (
                    <span key="banned" className="badge badge--err">
                      Banned
                    </span>
                  ) : null,
                ]}
                actions={
                  isMe ? (
                    <span className="badge badge--info">{ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role}</span>
                  ) : (
                    <>
                      <StateSelect value={u.role ?? 'user'} options={ROLE_OPTIONS} onChange={(next) => void changeRole(u, next)} />
                      <StateSelect
                        value={banned ? 'banned' : 'active'}
                        options={[
                          { value: 'active', label: 'Active' },
                          { value: 'banned', label: 'Banned' },
                        ]}
                        onChange={() => void toggleBan(u)}
                      />
                    </>
                  )
                }
              />
            );
          })}
        </ManageList>
        <Pagination currentPage={page} totalPages={total.pages} onPageChange={(p) => setQuery({ page: String(p) })} />
      </PageState>
    </Page>
  );
}
