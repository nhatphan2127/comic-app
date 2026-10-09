import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import { moderationApi } from '../../../services/api';
import type { Report, ReportStatus } from '../../../types/types';
import { formatTimeAgo } from '../../../helpers/formatDate';
import { useToast } from '../../../context/ToastContext';
import Segmented from '../../../components/Segmented/Segmented';
import Pagination from '../../../components/Pagination/Pagination';
import Page, { PageState } from '../../../console/ui/Page';
import { Toolbar } from '../../../console/ui/Toolbar';
import ManageRow, { ManageList } from '../../../console/ui/ManageRow';
import { useConsole } from '../../../console/ConsoleContext';
import useQueryState from '../../../console/useQueryState';
import style from './Reports.module.css';

const PAGE_SIZE = 12;
const STATUSES: ReportStatus[] = ['open', 'resolved', 'dismissed'];

const EMPTY_TEXT: Record<ReportStatus, string> = {
  open: 'Nobody has reported anything. Nice.',
  resolved: 'No resolved reports yet.',
  dismissed: 'No dismissed reports.',
};

/** /studio/reports: comics and comments flagged by readers. */
export default function ReportsModule() {
  const toast = useToast();
  const { refreshBadges } = useConsole();
  const [query, setQuery] = useQueryState({ status: 'open', page: '1' });
  const status = query.status as ReportStatus;
  const page = Number(query.page) || 1;

  const [items, setItems] = useState<Report[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<Partial<Record<ReportStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [res, ...totals] = await Promise.all([
        moderationApi.listReports({ status, page, pageSize: PAGE_SIZE }),
        ...STATUSES.map((s) => moderationApi.countReports(s)),
      ]);
      setItems(res.data);
      setTotalPages(Math.max(1, res.meta.totalPages));
      setCounts(Object.fromEntries(STATUSES.map((s, i) => [s, totals[i]])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string, failMessage: string) => {
    try {
      await action();
      toast.success(success);
      await load();
      refreshBadges();
    } catch (err) {
      toast.error(err, failMessage);
    }
  };

  const setReportStatus = (report: Report, next: ReportStatus) =>
    run(() => moderationApi.updateReport(report.id, next), next === 'open' ? 'Report reopened.' : `Report ${next}.`, 'Unable to update report');

  // Deleting the comment settles the report in the same click.
  const deleteComment = (report: Report) => {
    if (!report.target || !window.confirm('Delete this comment for everyone?')) return;
    const commentId = report.target.id;
    void run(
      async () => {
        await moderationApi.deleteComment(commentId);
        await moderationApi.updateReport(report.id, 'resolved');
      },
      'Comment deleted and report resolved.',
      'Unable to delete comment',
    );
  };

  return (
    <Page title="Reports" description="Comics and comments flagged by readers.">
      <Toolbar>
        <Segmented
          ariaLabel="Status"
          value={status}
          onChange={(v) => setQuery({ status: v })}
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'resolved', label: 'Resolved', count: counts.resolved },
            { value: 'dismissed', label: 'Dismissed', count: counts.dismissed },
          ]}
        />
      </Toolbar>

      <PageState loading={loading} loadingText="Loading reports…" error={error} empty={items.length === 0} emptyTitle="No reports here" emptyText={EMPTY_TEXT[status]}>
        <ManageList>
          {items.map((report) => {
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
                meta={[target?.title ?? 'Deleted item', `by ${reporter}`, formatTimeAgo(report.createdAt)]}
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
              >
                {isComment && target?.content ? <q className={style.quote}>{target.content}</q> : null}
                {report.details ? <p className={style.details}>{report.details}</p> : null}
              </ManageRow>
            );
          })}
        </ManageList>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setQuery({ page: String(p) })} />
      </PageState>
    </Page>
  );
}
