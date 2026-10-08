import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Search, X } from 'lucide-react';
import { chapterApi, moderationApi } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import type { Chapter, ChapterDetail, Comic, ComicDetail } from '../../../../types/types';
import { formatTimeAgo } from '../../../../helpers/formatDate';
import Segmented from '../../../../components/Segmented/Segmented';
import Pagination from '../../../../components/Pagination/Pagination';
import StatusBadge, { type ReviewStatus } from '../../../../components/StatusBadge/StatusBadge';
import { ChapterPreviewModal, ComicPreviewModal } from '../../../../components/SubmissionPreview/SubmissionPreview';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import ManageRow, { ManageList } from '../ManageRow/ManageRow';
import style from './ModerationPanel.module.css';

type Kind = 'comic' | 'chapter';
type Queue = { comics: Comic[]; chapters: Chapter[] };

const PAGE_SIZE = 12;
const EMPTY_QUEUE: Queue = { comics: [], chapters: [] };
const statusOf = (item: { status?: string }): ReviewStatus => (item.status?.toLowerCase() as ReviewStatus) || 'pending';

export default function ModerationPanel() {
  const { user, isLoggedIn } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const canModerate = isLoggedIn && (role === 'moderator' || role === 'admin');

  const [kind, setKind] = useState<Kind>('comic');
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [all, setAll] = useState<Queue>(EMPTY_QUEUE);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comicPreview, setComicPreview] = useState<{ open: boolean; data: ComicDetail | null }>({ open: false, data: null });
  const [chapterPreview, setChapterPreview] = useState<{ open: boolean; data: ChapterDetail | null }>({ open: false, data: null });

  // One request for everything; status filtering happens client-side so the counts stay in sync.
  const load = useCallback(async () => {
    if (!canModerate) {
      setError('Please sign in as a moderator or admin to view the moderation queue.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await moderationApi.getQueue();
      setAll({ comics: res.comics || [], chapters: res.chapters || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, [canModerate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [kind, status, query]);

  const source: (Comic | Chapter)[] = kind === 'comic' ? all.comics : all.chapters;
  const count = (s: ReviewStatus) => source.filter((i) => statusOf(i) === s).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((item) => {
      if (statusOf(item) !== status) return false;
      if (!q) return true;
      if (kind === 'comic') return ((item as Comic).name || '').toLowerCase().includes(q);
      const ch = item as Chapter;
      return (ch.title || '').toLowerCase().includes(q) || String(ch.chapterNumber).includes(q);
    });
  }, [source, status, query, kind]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const review = async (id: string, decision: 'accept' | 'reject') => {
    try {
      await moderationApi.review(kind, id, decision);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update submission');
    }
  };

  const preview = async (item: Comic | Chapter) => {
    try {
      if (kind === 'comic') {
        setComicPreview({ open: true, data: null });
        setComicPreview({ open: true, data: await moderationApi.getComicDetail(item.id) });
      } else {
        setChapterPreview({ open: true, data: null });
        setChapterPreview({ open: true, data: await chapterApi.getDetails(item.id) });
      }
    } catch (err) {
      setComicPreview({ open: false, data: null });
      setChapterPreview({ open: false, data: null });
      setError(err instanceof Error ? err.message : 'Unable to load preview');
    }
  };

  return (
    <PanelShell title="Moderation queue" subtitle="Preview submissions, then approve or reject them.">
      <div className={style.toolbar}>
        <Segmented
          ariaLabel="Submission type"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setQuery('');
          }}
          options={[
            { value: 'comic', label: 'Comics' },
            { value: 'chapter', label: 'Chapters' },
          ]}
        />
        <Segmented
          ariaLabel="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: 'Pending', count: count('pending') },
            { value: 'accept', label: 'Approved', count: count('accept') },
            { value: 'reject', label: 'Rejected', count: count('reject') },
          ]}
        />
      </div>

      <label className={style.search}>
        <Search size={15} />
        <input
          type="search"
          placeholder={kind === 'comic' ? 'Search comics…' : 'Search chapters…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <PanelState
        loading={loading}
        loadingText="Loading moderation queue…"
        error={error}
        empty={pageItems.length === 0}
        emptyTitle="Queue is clear"
        emptyText={query.trim() ? 'No submissions match your search.' : `No ${kind} submissions in this state.`}
      >
        <ManageList>
          {pageItems.map((item) => {
            const comic = kind === 'comic' ? (item as Comic) : null;
            const chapter = kind === 'chapter' ? (item as Chapter) : null;
            const itemStatus = statusOf(item);
            return (
              <ManageRow
                key={item.id}
                cover={comic ? comic.coverUrl : undefined}
                title={comic ? comic.name || 'Untitled comic' : `Chapter ${chapter?.chapterNumber}${chapter?.title ? ` · ${chapter.title}` : ''}`}
                meta={[
                  <StatusBadge key="status" status={itemStatus} />,
                  formatTimeAgo(item.updatedAt || item.createdAt),
                ]}
                actions={
                  <>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void preview(item)}>
                      <Eye size={14} />
                      Preview
                    </button>
                    {itemStatus !== 'accept' ? (
                      <button type="button" className="btn btn--success btn--sm" onClick={() => void review(item.id, 'accept')}>
                        <Check size={14} />
                        Approve
                      </button>
                    ) : null}
                    {itemStatus !== 'reject' ? (
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => void review(item.id, 'reject')}>
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
        <Pagination currentPage={page} totalPages={pageCount} onPageChange={setPage} />
      </PanelState>

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
    </PanelShell>
  );
}
