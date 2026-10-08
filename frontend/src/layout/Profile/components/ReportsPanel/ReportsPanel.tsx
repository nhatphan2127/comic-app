import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import { moderationApi } from '../../../../services/api';
import type { Report, ReportStatus } from '../../../../types/types';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import Segmented from '../../../../components/Segmented/Segmented';
import Pagination from '../../../../components/Pagination/Pagination';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import ManageRow, { ManageList } from '../ManageRow/ManageRow';
import style from './ReportsPanel.module.css';

const PAGE_SIZE = 12;

const EMPTY_TEXT: Record<ReportStatus, string> = {
  open: 'Nobody has reported anything. Nice.',
  resolved: 'No resolved reports yet.',
  dismissed: 'No dismissed reports.',
};

/** Moderators' queue of comics and comments flagged by readers. */
export default function ReportsPanel() {
  const [status, setStatus] = useState<ReportStatus>('open');
  const [items, setItems] = useState<Report[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await moderationApi.getReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [status]);

  const run = async (action: () => Promise<unknown>, failMessage: string) => {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : failMessage);
    }
  };

  const setReportStatus = (report: Report, next: ReportStatus) =>
    run(() => moderationApi.updateReport(report.id, next), 'Unable to update report');

  // Deleting the comment settles the report in the same click.
  const deleteComment = (report: Report) => {
    if (!report.target || !window.confirm('Delete this comment for everyone?')) return;
    const commentId = report.target.id;
    void run(async () => {
      await moderationApi.deleteComment(commentId);
      await moderationApi.updateReport(report.id, 'resolved');
    }, 'Unable to delete comment');
  };

  const count = (s: ReportStatus) => items.filter((r) => r.status === s).length;
  const visible = items.filter((r) => r.status === status);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PanelShell title="Reports" subtitle="Comics and comments flagged by readers.">
      <Segmented
        ariaLabel="Status"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Open', count: count('open') },
          { value: 'resolved', label: 'Resolved', count: count('resolved') },
          { value: 'dismissed', label: 'Dismissed', count: count('dismissed') },
        ]}
      />

      <PanelState
        loading={loading}
        loadingText="Loading reports…"
        error={error}
        empty={pageItems.length === 0}
        emptyTitle="No reports here"
        emptyText={EMPTY_TEXT[status]}
      >
        <ManageList>
          {pageItems.map((report) => {
            const target = report.target;
            const isComment = target?.type === 'comment';
            const reporter = report.reporter?.displayName || report.reporter?.username || 'Unknown';
            return (
              <ManageRow
                key={report.id}
                title={
                  <span className={style.title}>
                    <span className="badge badge--warn">{isComment ? 'Comment' : 'Comic'}</span>
                    {report.reason}
                  </span>
                }
                meta={[
                  target?.title ?? 'Deleted item',
                  `by ${reporter}`,
                  formatTimeAgo(report.createdAt),
                  isComment && target?.content ? <q key="quote" className={style.quote}>{target.content}</q> : null,
                  report.details ? <span key="details" className={style.details}>{report.details}</span> : null,
                ]}
                actions={
                  <>
                    {target?.path ? (
                      <Link to={target.path} className="btn btn--ghost btn--sm" target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        Open
                      </Link>
                    ) : null}
                    {report.status === 'open' ? (
                      <>
                        {isComment && target?.content ? (
                          <button type="button" className="btn btn--danger btn--sm" onClick={() => deleteComment(report)}>
                            <Trash2 size={14} />
                            Delete comment
                          </button>
                        ) : null}
                        <button type="button" className="btn btn--success btn--sm" onClick={() => void setReportStatus(report, 'resolved')}>
                          <Check size={14} />
                          Resolve
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void setReportStatus(report, 'dismissed')}>
                          <X size={14} />
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void setReportStatus(report, 'open')}>
                        <RotateCcw size={14} />
                        Reopen
                      </button>
                    )}
                  </>
                }
              />
            );
          })}
        </ManageList>
        <Pagination currentPage={page} totalPages={pageCount} onPageChange={setPage} />
      </PanelState>
    </PanelShell>
  );
}
