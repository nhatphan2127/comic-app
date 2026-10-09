import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { adminApi } from '../../../services/api';
import type { RoleRequestListItem, RoleRequestStatus } from '../../../types/types';
import { useToast } from '../../../context/ToastContext';
import { formatTimeAgo } from '../../../helpers/formatDate';
import { resolveUploadUrl } from '../../../helpers/getImage';
import Avatar from '../../../components/Avatar/Avatar';
import Modal from '../../../components/Modal/Modal';
import Segmented from '../../../components/Segmented/Segmented';
import Pagination from '../../../components/Pagination/Pagination';
import Page, { PageState } from '../../../console/ui/Page';
import { Toolbar } from '../../../console/ui/Toolbar';
import { useConsole } from '../../../console/ConsoleContext';
import useQueryState from '../../../console/useQueryState';
import cx from '../../../helpers/cx';
import style from './RoleRequests.module.css';

const PAGE_SIZE = 10;
type Filter = Exclude<RoleRequestStatus, 'cancelled'>;
const FILTERS: Filter[] = ['pending', 'approved', 'rejected'];

const STATUS_BADGE: Record<RoleRequestStatus, string> = {
  pending: 'badge--warn',
  approved: 'badge--ok',
  rejected: 'badge--err',
  cancelled: '',
};

const EMPTY_TEXT: Record<Filter, string> = {
  pending: 'No one is waiting for an answer.',
  approved: 'No approved requests yet.',
  rejected: 'No rejected requests.',
};

/** Turns bare URLs in a text into links. */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** /admin/role-requests: readers asking to become contributors. */
export default function RoleRequestsModule() {
  const toast = useToast();
  const { refreshBadges } = useConsole();
  const [query, setQuery] = useQueryState({ status: 'pending', page: '1' });
  const status = query.status as Filter;
  const page = Number(query.page) || 1;

  const [items, setItems] = useState<RoleRequestListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deciding, setDeciding] = useState<{ request: RoleRequestListItem; status: 'approved' | 'rejected' } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [res, pending] = await Promise.all([
        adminApi.listRoleRequests({ status, page, pageSize: PAGE_SIZE }),
        adminApi.listRoleRequests({ status: 'pending', pageSize: 1 }),
      ]);
      setItems(res.data);
      setTotalPages(Math.max(1, res.meta.totalPages));
      setPendingCount(pending.meta.totalItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requests');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openDecision = (request: RoleRequestListItem, next: 'approved' | 'rejected') => {
    setNote('');
    setDeciding({ request, status: next });
  };

  const decide = async () => {
    if (!deciding) return;
    setSaving(true);
    try {
      await adminApi.decideRoleRequest(deciding.request.id, deciding.status, note.trim() || undefined);
      const who = deciding.request.user.displayName || deciding.request.user.username;
      toast.success(deciding.status === 'approved' ? `${who} is now a contributor.` : `Request from ${who} was declined.`);
      setDeciding(null);
      await load();
      refreshBadges();
    } catch (err) {
      toast.error(err, 'Unable to save the decision');
    } finally {
      setSaving(false);
    }
  };

  const approving = deciding?.status === 'approved';

  return (
    <Page title="Contributor requests" description="Readers asking for contributor access. Approving gives them the Studio; they are notified either way.">
      <Toolbar>
        <Segmented
          ariaLabel="Status"
          value={status}
          onChange={(v) => setQuery({ status: v })}
          options={FILTERS.map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1), count: f === 'pending' ? pendingCount : undefined }))}
        />
      </Toolbar>

      <PageState loading={loading} loadingText="Loading requests…" error={error} empty={items.length === 0} emptyTitle="No requests here" emptyText={EMPTY_TEXT[status]}>
        <ul className={style.list}>
          {items.map((r) => {
            const name = r.user.displayName || r.user.username;
            return (
              <li key={r.id} className={style.item}>
                <header className={style.head}>
                  <Avatar name={name} src={resolveUploadUrl(r.user.avatar)} size={42} />
                  <div className={style.who}>
                    <Link to={`/users/${r.user.id}`} className={style.name}>
                      {name}
                    </Link>
                    <span className={style.meta}>
                      @{r.user.username} · member {formatTimeAgo(r.user.createdAt)} · asked {formatTimeAgo(r.createdAt)}
                    </span>
                  </div>
                  <span className={cx('badge', STATUS_BADGE[r.status])}>{r.status}</span>
                </header>

                <div className={style.block}>
                  <span className={style.label}>Why they want to contribute</span>
                  <p className={style.text}>{r.reason}</p>
                </div>
                {r.portfolio ? (
                  <div className={style.block}>
                    <span className={style.label}>Experience & links</span>
                    <p className={style.text}>
                      <Linkified text={r.portfolio} />
                    </p>
                  </div>
                ) : null}
                {r.status !== 'pending' ? (
                  <div className={style.decision}>
                    {r.status === 'approved' ? 'Approved' : 'Declined'}
                    {r.reviewer ? ` by ${r.reviewer.displayName || r.reviewer.username}` : ''} {formatTimeAgo(r.updatedAt)}
                    {r.reviewNote ? <q className={style.note}>{r.reviewNote}</q> : null}
                  </div>
                ) : (
                  <div className={style.actions}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => openDecision(r, 'rejected')}>
                      <X size={14} />
                      Decline
                    </button>
                    <button type="button" className="btn btn--success btn--sm" onClick={() => openDecision(r, 'approved')}>
                      <Check size={14} />
                      Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setQuery({ page: String(p) })} />
      </PageState>

      <Modal
        isOpen={Boolean(deciding)}
        onClose={() => !saving && setDeciding(null)}
        size="sm"
        title={approving ? 'Approve request' : 'Decline request'}
        subtitle={deciding ? `@${deciding.request.user.username}` : undefined}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDeciding(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={cx('btn', approving ? 'btn--primary' : 'btn--danger')} onClick={() => void decide()} disabled={saving}>
              {saving ? 'Saving…' : approving ? 'Approve' : 'Decline'}
            </button>
          </>
        }
      >
        <label className={style.noteField}>
          <span>
            {approving
              ? 'They become a contributor and get access to the Studio. Add a welcome note (optional):'
              : 'They can ask again in 7 days. Tell them why (optional, they will see it):'}
          </span>
          <textarea className="input" rows={4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </Modal>
    </Page>
  );
}
