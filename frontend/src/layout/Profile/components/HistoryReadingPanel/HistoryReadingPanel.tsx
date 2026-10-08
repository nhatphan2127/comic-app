import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import HistoryCard from '../../../../components/HistoryCard/HistoryCard';
import Pagination from '../../../../components/Pagination/Pagination';
import { userApi } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import type { HistoryItem } from '../../../../types/types';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import style from './HistoryReadingPanel.module.css';

const PAGE_SIZE = 30;

export default function ReadHistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [clearing, setClearing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    userApi
      .getReadingHistory()
      .then((history) => setItems(history ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải lịch sử đọc.'))
      .finally(() => setLoading(false));
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  // Clamp so removing the last item on the final page falls back to the previous page.
  const currentPage = Math.min(page, pageCount);
  const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const removeItem = async (chapterId: string) => {
    try {
      await userApi.deleteHistoryItem(chapterId);
      setItems((prev) => prev.filter((item) => item.chapterId !== chapterId));
    } catch (err) {
      toast.error(err, 'Could not remove this entry.');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear your whole reading history? Saved page positions are lost too.')) return;
    setClearing(true);
    try {
      await userApi.clearReadingHistory();
      setItems([]);
      setPage(1);
    } catch (err) {
      toast.error(err, 'Không thể xoá lịch sử đọc.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <PanelShell
      title="Reading history"
      subtitle={`Pick up where you left off · ${items.length} ${items.length === 1 ? 'chapter' : 'chapters'} logged`}
      actions={
        items.length > 0 ? (
          <button type="button" className="btn btn--danger btn--sm" onClick={clearAll} disabled={clearing}>
            <Trash2 size={14} />
            {clearing ? 'Clearing…' : 'Clear all'}
          </button>
        ) : null
      }
    >
      <PanelState
        loading={loading}
        error={error}
        empty={items.length === 0}
        loadingText="Loading history…"
        emptyTitle="No reading history yet"
        emptyText="Chapters you open will show up here."
      >
        <div className={style.grid}>
          {pageItems.map((item) => (
            <HistoryCard key={item.chapterId} item={item} onRemove={() => removeItem(item.chapterId)} />
          ))}
        </div>
        <Pagination currentPage={currentPage} totalPages={pageCount} onPageChange={setPage} />
      </PanelState>
    </PanelShell>
  );
}
