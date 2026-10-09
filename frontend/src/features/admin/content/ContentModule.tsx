import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye } from 'lucide-react';
import { adminApi, moderationApi } from '../../../services/api';
import type { Chapter, ChapterDetail, Comic, ComicDetail } from '../../../types/types';
import { useToast } from '../../../context/ToastContext';
import { formatTimeAgo } from '../../../helpers/formatDate';
import Segmented from '../../../components/Segmented/Segmented';
import Pagination from '../../../components/Pagination/Pagination';
import StatusBadge from '../../../components/StatusBadge/StatusBadge';
import { ChapterPreviewModal, ComicPreviewModal } from '../../../components/SubmissionPreview/SubmissionPreview';
import Page, { PageState } from '../../../console/ui/Page';
import { SearchField, Toolbar } from '../../../console/ui/Toolbar';
import ManageRow, { ManageList, StateSelect } from '../../../console/ui/ManageRow';
import useQueryState from '../../../console/useQueryState';

type Kind = 'comic' | 'chapter';
type Visibility = 'public' | 'hidden';
type Item = Comic | Chapter;

const PAGE_SIZE = 20;

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'hidden', label: 'Hidden' },
];

const COPY: Record<Kind, { title: string; description: string; search: string }> = {
  comic: { title: 'Comics', description: 'Every comic, including hidden and unreviewed ones. Hide a comic to take it off the site.', search: 'Search comics…' },
  chapter: { title: 'Chapters', description: 'Every chapter, including hidden and unreviewed ones.', search: 'Search by chapter title or comic…' },
};

/** /admin/comics and /admin/chapters: visibility management. */
function ContentModule({ kind }: { kind: Kind }) {
  const toast = useToast();
  const [query, setQuery] = useQueryState({ q: '', visibility: 'all', page: '1' });
  const visibility = query.visibility as 'all' | Visibility;
  const page = Number(query.page) || 1;

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState({ items: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comicPreview, setComicPreview] = useState<{ open: boolean; data: ComicDetail | null }>({ open: false, data: null });
  const [chapterPreview, setChapterPreview] = useState<{ open: boolean; data: ChapterDetail | null }>({ open: false, data: null });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi.listContent<Item>(kind, {
        q: query.q.trim(),
        visibility: visibility === 'all' ? undefined : visibility,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal({ items: res.meta.totalItems, pages: Math.max(1, res.meta.totalPages) });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to load ${kind}s`);
    } finally {
      setLoading(false);
    }
  }, [kind, query.q, visibility, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setItemVisibility = async (item: Item, next: Visibility) => {
    try {
      if (kind === 'comic') await adminApi.updateComicVisibility(item.id, next);
      else await adminApi.updateChapterVisibility(item.id, next);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, visibility: next } : i)));
      toast.success(next === 'hidden' ? 'Hidden from readers.' : 'Visible to readers again.');
    } catch (err) {
      toast.error(err, `Unable to update ${kind}`);
    }
  };

  // The staff endpoints also return hidden and pending items, which the public ones 404 on.
  const preview = async (item: Item) => {
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

  const publicPath = (item: Item) => {
    if (kind === 'comic') return (item as Comic).url ? `/comics/${(item as Comic).url}` : null;
    const ch = item as Chapter;
    return ch.comicUrl ? `/comics/${ch.comicUrl}/${ch.id}` : null;
  };

  return (
    <Page title={COPY[kind].title} description={`${total.items} in total. ${COPY[kind].description}`}>
      <Toolbar>
        <Segmented
          ariaLabel="Visibility"
          value={visibility}
          onChange={(v) => setQuery({ visibility: v })}
          options={[{ value: 'all' as const, label: 'All' }, ...VISIBILITY_OPTIONS]}
        />
        <SearchField value={query.q} onChange={(q) => setQuery({ q })} placeholder={COPY[kind].search} debounceMs={300} />
      </Toolbar>

      <PageState loading={loading} error={error} empty={items.length === 0} emptyTitle="Nothing found" emptyText="Try another filter or search.">
        <ManageList>
          {items.map((item) => {
            const comic = kind === 'comic' ? (item as Comic) : null;
            const chapter = kind === 'chapter' ? (item as Chapter) : null;
            const path = publicPath(item);
            return (
              <ManageRow
                key={item.id}
                cover={comic ? comic.coverUrl : undefined}
                title={comic ? comic.name : `Chapter ${chapter?.chapterNumber}${chapter?.title ? ` · ${chapter.title}` : ''}`}
                meta={[
                  <StatusBadge key="status" status={item.status} />,
                  chapter?.comicName ?? null,
                  `Updated ${formatTimeAgo(item.updatedAt || item.createdAt)}`,
                ]}
                actions={
                  <>
                    {path && item.status === 'accept' ? (
                      <Link to={path} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm btn--icon" aria-label="Open on the site" title="Open on the site">
                        <ExternalLink size={14} />
                      </Link>
                    ) : null}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void preview(item)}>
                      <Eye size={14} />
                      Preview
                    </button>
                    <StateSelect value={(item.visibility ?? 'public') as Visibility} options={VISIBILITY_OPTIONS} onChange={(v) => void setItemVisibility(item, v)} />
                  </>
                }
              />
            );
          })}
        </ManageList>
        <Pagination currentPage={page} totalPages={total.pages} onPageChange={(p) => setQuery({ page: String(p) })} />
      </PageState>

      <ComicPreviewModal isOpen={comicPreview.open} data={comicPreview.data} loading={!comicPreview.data} onClose={() => setComicPreview({ open: false, data: null })} />
      <ChapterPreviewModal isOpen={chapterPreview.open} data={chapterPreview.data} loading={!chapterPreview.data} onClose={() => setChapterPreview({ open: false, data: null })} />
    </Page>
  );
}

export const ComicsModule = () => <ContentModule key="comic" kind="comic" />;
export const ChaptersModule = () => <ContentModule key="chapter" kind="chapter" />;
