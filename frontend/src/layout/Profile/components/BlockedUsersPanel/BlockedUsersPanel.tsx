import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from '../../../../services/api';
import type { BlockedUser } from '../../../../types/types';
import { useToast } from '../../../../context/ToastContext';
import { resolveUploadUrl } from '../../../../helpers/getImage';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import Avatar from '../../../../components/Avatar/Avatar';
import Pagination from '../../../../components/Pagination/Pagination';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import style from './BlockedUsersPanel.module.css';

const PAGE_SIZE = 20;

export default function BlockedUsersPanel() {
  const toast = useToast();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (target: number) => {
    setError(null);
    try {
      const { data, meta } = await userApi.getBlockedUsers(target, PAGE_SIZE);
      // Unblocking the last user of the last page leaves it empty: step back a page.
      if (data.length === 0 && target > 1) return setPage(target - 1);
      setUsers(data);
      setTotalPages(Math.max(1, meta.totalPages));
      setTotalItems(meta.totalItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load blocked users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const unblock = async (user: BlockedUser) => {
    setBusyId(user.id);
    try {
      await userApi.unblockUser(user.id);
      toast.success(`${user.displayName || user.username} is unblocked.`);
      await load(page);
    } catch (err) {
      toast.error(err, 'Could not unblock this user.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PanelShell
      title="Blocked users"
      subtitle="Their comments, and the replies under them, are hidden from you, and their replies don't notify you. Nobody else is affected."
    >
      <PanelState
        loading={loading}
        error={error}
        empty={users.length === 0}
        emptyTitle="You haven't blocked anyone"
        emptyText="Use the ··· menu on a comment or a profile to block someone."
      >
        <p className={style.count}>{totalItems === 1 ? '1 blocked user' : `${totalItems} blocked users`}</p>
        <ul className={style.list}>
          {users.map((user) => {
            const name = user.displayName || user.username;
            return (
              <li key={user.id} className={style.row}>
                <Link to={`/users/${user.id}`} className={style.who}>
                  <Avatar name={name} src={resolveUploadUrl(user.avatar)} size={40} />
                  <span className={style.names}>
                    <span className={style.name}>{name}</span>
                    <span className={`${style.meta} mono`}>
                      @{user.username} · blocked {formatTimeAgo(user.blockedAt)}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busyId === user.id}
                  onClick={() => unblock(user)}
                >
                  Unblock
                </button>
              </li>
            );
          })}
        </ul>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={loading} />
      </PanelState>
    </PanelShell>
  );
}
