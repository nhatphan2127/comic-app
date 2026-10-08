import cx from '../../helpers/cx';

export type ReviewStatus = 'pending' | 'accept' | 'reject';

const STATUS: Record<ReviewStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'badge--warn' },
  accept: { label: 'Approved', tone: 'badge--ok' },
  reject: { label: 'Rejected', tone: 'badge--err' },
};

export const STATUS_LABEL = (status: ReviewStatus) => STATUS[status]?.label ?? status;

/** Coloured badge for moderation status (pending / accept / reject). */
export default function StatusBadge({ status, className }: { status?: ReviewStatus | null; className?: string }) {
  if (!status) return null;
  const s = STATUS[status] ?? { label: status, tone: '' };
  return <span className={cx('badge', s.tone, className)}>{s.label}</span>;
}
