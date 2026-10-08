import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { reportApi } from '../../services/api';
import type { ReportTargetType } from '../../types/types';
import Modal from '../Modal/Modal';
import cx from '../../helpers/cx';
import styles from './ReportDialog.module.css';

const REASONS: Record<ReportTargetType, string[]> = {
  comic: ['Wrong or missing information', 'Broken or missing pages', 'Wrong content rating', 'Duplicate title', 'Copyright issue', 'Other'],
  comment: ['Spam or advertising', 'Harassment or hate speech', 'Spoiler without warning', 'Sexual or violent content', 'Other'],
};

const DETAILS_MAX = 1000;

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Shown under the title, e.g. the comic's name. */
  targetLabel?: string;
}

/** Lets a logged-in reader flag a comic or a comment for the moderators. */
export default function ReportDialog({ isOpen, onClose, targetType, targetId, targetLabel }: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Start fresh every time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setDetails('');
    setError(null);
    setSent(false);
  }, [isOpen]);

  const needsDetails = reason === 'Other';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return setError('Please choose a reason.');
    if (needsDetails && !details.trim()) return setError('Please describe the problem.');

    setSending(true);
    setError(null);
    try {
      await reportApi.create(targetType, targetId, reason, details.trim() || undefined);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the report.');
    } finally {
      setSending(false);
    }
  };

  const title = targetType === 'comic' ? 'Report an issue' : 'Report comment';

  if (sent) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="sm" ariaLabel={title}>
        <div className={styles.done}>
          <CheckCircle2 size={36} className={styles.doneIcon} />
          <strong>Thanks for letting us know</strong>
          <p>A moderator will look into it.</p>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title} subtitle={targetLabel}>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.options} role="radiogroup" aria-label="Reason">
          {REASONS[targetType].map((option) => (
            <label key={option} className={cx(styles.option, reason === option && styles.optionOn)}>
              <input
                type="radio"
                name="report-reason"
                className="sr-only"
                checked={reason === option}
                onChange={() => setReason(option)}
              />
              <span className={styles.radio} aria-hidden="true" />
              {option}
            </label>
          ))}
        </div>

        <label className={styles.field}>
          <span>Details {needsDetails ? null : <small>(optional)</small>}</span>
          <textarea
            className="input"
            rows={3}
            maxLength={DETAILS_MAX}
            placeholder="Anything that helps a moderator find the problem"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button type="submit" className="btn btn--danger" disabled={sending || !reason}>
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
