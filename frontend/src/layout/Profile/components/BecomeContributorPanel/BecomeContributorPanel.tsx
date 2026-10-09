import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookUp, CheckCircle2, Clock3, LayoutDashboard, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { roleRequestApi } from '../../../../services/api';
import type { RoleRequestState } from '../../../../types/types';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { canContribute, isAdmin } from '../../../../helpers/roles';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import cx from '../../../../helpers/cx';
import style from './BecomeContributorPanel.module.css';

const REASON_MIN = 20;
const REASON_MAX = 1000;

const PERKS = [
  { icon: Upload, title: 'Upload chapters', text: 'Add new chapters to any comic in the library.' },
  { icon: BookUp, title: 'Suggest comics', text: 'Bring series we are missing, with cover and details.' },
  { icon: ShieldCheck, title: 'Reviewed fairly', text: 'Moderators check each upload before it goes live.' },
];

/** Profile → "Become a contributor": ask for the role, follow the request, or jump to the Studio. */
export default function BecomeContributorPanel() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<RoleRequestState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const isContributor = canContribute(user?.role);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await roleRequestApi.get();
      setState(next);
      // Approved while this tab was open: pick up the new role right away.
      if (next.request?.status === 'approved') updateUser({ role: 'contributor' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your request');
    }
  }, [updateUser]);

  useEffect(() => {
    if (!isContributor) load();
  }, [isContributor, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await roleRequestApi.create(reason.trim(), portfolio.trim() || undefined);
      toast.success('Request sent. An admin will get back to you soon.');
      setReason('');
      setPortfolio('');
      setAgreed(false);
      await load();
    } catch (err) {
      toast.error(err, 'Unable to send your request');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Withdraw your request?')) return;
    try {
      await roleRequestApi.cancel();
      toast.info('Request withdrawn.');
      await load();
    } catch (err) {
      toast.error(err, 'Unable to withdraw the request');
    }
  };

  if (isContributor) {
    return (
      <PanelShell title="Contributor access" subtitle="Your tools live in their own workspace.">
        <div className={cx(style.status, style.statusOk)}>
          <CheckCircle2 size={22} />
          <div>
            <strong>You're a {user?.role}.</strong>
            <p>Upload chapters, suggest comics{isAdmin(user?.role) ? ', moderate and manage the platform' : ''} from the Studio.</p>
          </div>
        </div>
        <div className={style.links}>
          <Link to="/studio" className="btn btn--primary">
            <LayoutDashboard size={15} />
            Open Studio
          </Link>
          {isAdmin(user?.role) ? (
            <Link to="/admin" className="btn btn--ghost">
              Admin console
            </Link>
          ) : null}
        </div>
      </PanelShell>
    );
  }

  const request = state?.request;
  const reasonLength = reason.trim().length;

  return (
    <PanelShell title="Become a contributor" subtitle="Help the library grow by uploading chapters and suggesting comics.">
      <PanelState loading={!state && !error} error={error}>
        <ul className={style.perks}>
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className={style.perk}>
              <span className={style.perkIcon}>
                <Icon size={18} />
              </span>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {request?.status === 'pending' ? (
          <div className={cx(style.status, style.statusWait)}>
            <Clock3 size={22} />
            <div>
              <strong>Your request is waiting for an admin.</strong>
              <p>Sent {formatTimeAgo(request.createdAt)}. You'll get a notification when it's answered.</p>
              <blockquote className={style.quote}>{request.reason}</blockquote>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void cancel()}>
                Withdraw request
              </button>
            </div>
          </div>
        ) : null}

        {request?.status === 'rejected' ? (
          <div className={cx(style.status, style.statusErr)}>
            <XCircle size={22} />
            <div>
              <strong>Your last request was declined{state?.retryAfterDays ? '' : ', but you can try again'}.</strong>
              {request.reviewNote ? <blockquote className={style.quote}>{request.reviewNote}</blockquote> : null}
              {state?.retryAfterDays ? (
                <p>
                  You can send a new request in {state.retryAfterDays} day{state.retryAfterDays === 1 ? '' : 's'}.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {state?.canRequest ? (
          <form className={style.form} onSubmit={submit}>
            <label className={style.field}>
              <span>Why do you want to contribute?</span>
              <textarea
                className="input"
                rows={4}
                maxLength={REASON_MAX}
                placeholder="Which comics would you upload? Do you translate or scan?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <small className={cx(style.counter, reasonLength > 0 && reasonLength < REASON_MIN && style.counterLow)}>
                {reasonLength < REASON_MIN ? `At least ${REASON_MIN} characters (${reasonLength}/${REASON_MIN})` : `${reasonLength}/${REASON_MAX}`}
              </small>
            </label>
            <label className={style.field}>
              <span>
                Experience or links <em>(optional)</em>
              </span>
              <textarea
                className="input"
                rows={3}
                maxLength={1000}
                placeholder="Scanlation group, previous uploads, social profiles…"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
              />
            </label>
            <label className={style.agree}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I'll only upload content I'm allowed to share, with correct content ratings.</span>
            </label>
            <div className={style.actions}>
              <button type="submit" className="btn btn--primary" disabled={saving || !agreed || reasonLength < REASON_MIN}>
                {saving ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        ) : null}
      </PanelState>
    </PanelShell>
  );
}
