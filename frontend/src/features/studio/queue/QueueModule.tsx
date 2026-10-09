import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, X } from 'lucide-react';
import { moderationApi } from '../../../services/api';
import type { Chapter, ChapterDetail, Comic, ComicDetail } from '../../../types/types';
import { formatTimeAgo } from '../../../helpers/formatDate';
import { useToast } from '../../../context/ToastContext';
import Segmented from '../../../components/Segmented/Segmented';
import Pagination from '../../../components/Pagination/Pagination';
import StatusBadge, { EditInReviewBadge, type ReviewStatus } from '../../../components/StatusBadge/StatusBadge';
import { ChapterPreviewModal, ComicPreviewModal } from '../../../components/SubmissionPreview/SubmissionPreview';
import Page, { PageState } from '../../../console/ui/Page';
import { SearchField, Toolbar } from '../../../console/ui/Toolbar';
import ManageRow, { ManageList } from '../../../console/ui/ManageRow';
import { useConsole } from '../../../console/ConsoleContext';
import useQueryState from '../../../console/useQueryState';

type Kind = 'comic' | 'chapter';
type Queue = { comics: Comic[]; chapters: Chapter[] };

const PAGE_SIZE = 12;
const EMPTY_QUEUE: Queue = { comics: [], chapters: [] };
const statusOf = (item: { status?: string }): ReviewStatus => (item.status?.toLowerCase() as ReviewStatus) || 'pending';

const chapterTitle = (ch: Chapter) => `Chapter ${ch.chapterNumber}${ch.title ? ` · ${ch.title}` : ''}`;

/** /studio/queue: submissions waiting for a moderator. */
export default function QueueModule() {
  const toast = useToast();
  const { refreshBadges } = useConsole();
  const [query, setQuery] = useQueryState({ kind: 'comic', status: 'pending', q: '', page: '1' });
  const kind = query.kind as Kind;
  const status = query.status as ReviewStatus;
  const page = Number(query.page) || 1;

  const [all, setAll] = useState<Queue>(EMPTY_QUEUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [comicPreview, setComicPreview] = useState<{ open: boolean; data: ComicDetail | null }>({ open: false, data: null });
  const [chapterPreview, setChapterPreview] = useState<{ open: boolean; data: ChapterDetail | null }>({ open: false, data: null });

  // One request for everything; status filtering happens here so the counts stay in sync.
  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await moderationApi.getQueue();
      setAll({ comics: res.comics || [], chapters: res.chapters || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const source: (Comic | Chapter)[] = kind === 'comic' ? all.comics : all.chapters;
  const count = (s: ReviewStatus) => source.filter((i) => statusOf(i) === s).length;
  const pendingOf = (items: (Comic | Chapter)[]) => items.filter((i) => statusOf(i) === 'pending').length;

  const visible = useMemo(() => {
    const q = query.q.trim().toLowerCase();
    return source.filter((item) => {
      if (statusOf(item) !== status) return false;
      if (!q) return true;
      if (kind === 'comic') return ((item as Comic).name || '').toLowerCase().includes(q);
      const ch = item as Chapter;
      return [ch.title, ch.comicName, String(ch.chapterNumber)].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [source, status, query.q, kind]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const review = async (item: Comic | Chapter, decision: 'accept' | 'reject') => {
    setBusyId(item.id);
    try {
      await moderationApi.review(kind, item.id, decision);
      toast.success(decision === 'accept' ? 'Approved. The contributor has been notified.' : 'Rejected. The contributor has been notified.');
      await load();
      refreshBadges();
    } catch (err) {
      toast.error(err, 'Unable to update submission');
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (item: Comic | Chapter) => {
    try {
      if (kind === 'comic') {
        setComicPreview({ open: true, data: null });
        setComicPreview({ open: true, data: await moderationApi.getComicDetail(item.id) });
      } else {
        setChapterPreview({ open: true, data: null });
        setChapterPreview({ open: true, data: await moderationApi.getChapterDetail(item.id) });
      }
    } catch (err) {
      setComicPreview({ open: false, data: null });
      setChapterPreview({ open: false, data: null });
      toast.error(err, 'Unable to load preview');
    }
  };

  return (
    <Page title="Review queue" description="Preview what contributors submitted, then approve or reject it.">
      <Toolbar>
        <Segmented
          ariaLabel="Submission type"
          value={kind}
          onChange={(v) => setQuery({ kind: v, q: '' })}
          options={[
            { value: 'comic', label: 'Comics', count: pendingOf(all.comics) },
            { value: 'chapter', label: 'Chapters', count: pendingOf(all.chapters) },
          ]}
        />
        <Segmented
          ariaLabel="Status"
          value={status}
          onChange={(v) => setQuery({ status: v })}
          options={[
            { value: 'pending', label: 'Pending', count: count('pending') },
            { value: 'accept', label: 'Approved', count: count('accept') },
            { value: 'reject', label: 'Rejected', count: count('reject') },
          ]}
        />
        <SearchField value={query.q} onChange={(q) => setQuery({ q })} placeholder={kind === 'comic' ? 'Search comics…' : 'Search chapters or comics…'} />
      </Toolbar>

      <PageState
        loading={loading}
        loadingText="Loading the review queue…"
        error={error}
        empty={pageItems.length === 0}
        emptyTitle={status === 'pending' ? 'All caught up' : 'Nothing here'}
        emptyText={query.q.trim() ? 'No submissions match your search.' : `No ${kind} submissions in this state.`}
      >
        <ManageList>
          {pageItems.map((item) => {
            const comic = kind === 'comic' ? (item as Comic) : null;
            const chapter = kind === 'chapter' ? (item as Chapter) : null;
            const itemStatus = statusOf(item);
            const busy = busyId === item.id;
            return (
              <ManageRow
                key={item.id}
                cover={comic ? comic.coverUrl : undefined}
                title={comic ? comic.name || 'Untitled comic' : chapterTitle(chapter as Chapter)}
                meta={[
                  <StatusBadge key="status" status={itemStatus} />,
                  comic?.pendingEdit ? <EditInReviewBadge key="edit" /> : null,
                  chapter?.comicName ?? null,
                  formatTimeAgo(item.updatedAt || item.createdAt),
                ]}
                actions={
                  <>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void preview(item)}>
                      <Eye size={14} />
                      Preview
                    </button>
                    {itemStatus !== 'accept' ? (
                      <button type="button" className="btn btn--success btn--sm" disabled={busy} onClick={() => void review(item, 'accept')}>
                        <Check size={14} />
                        Approve
                      </button>
                    ) : null}
                    {itemStatus !== 'reject' ? (
                      <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => void review(item, 'reject')}>
                        <X size={14} />
                        Reject
                      </button>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </ManageList>
        <Pagination currentPage={page} totalPages={pageCount} onPageChange={(p) => setQuery({ page: String(p) })} />
      </PageState>

      <ComicPreviewModal
        isOpen={comicPreview.open}
        data={comicPreview.data}
        loading={!comicPreview.data}
        onClose={() => setComicPreview({ open: false, data: null })}
      />
      <ChapterPreviewModal
        isOpen={chapterPreview.open}
        data={chapterPreview.data}
        loading={!chapterPreview.data}
        onClose={() => setChapterPreview({ open: false, data: null })}
      />
    </Page>
  );
}
