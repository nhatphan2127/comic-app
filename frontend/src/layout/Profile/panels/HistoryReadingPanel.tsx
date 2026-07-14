import { useEffect, useState } from 'react';
import HistoryCard from '../../../components/HistoryCard';
import { userApi, API_UPLOADS } from '../../../services/api';
import type { HistoryItem } from '../../../types/types';
import { formatTimeAgo } from '../../../helpers/formatDate';
import { getImage } from '../../../helpers/getImage';

export default function ReadHistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const history = await userApi.getReadingHistory();
        setItems(history ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải lịch sử đọc.');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const handleRemoveItem = async (chapterId: string) => {
    try {
      await userApi.deleteHistoryItem(chapterId);
      setItems((prev) => prev.filter((item) => item.chapterId !== chapterId));
    } catch (err) {
      console.error('Remove history item failed', err);
    }
  };

  const totalLogged = items.length;

  return (
    <div className="user-content">
      <div className="uview">
        <div className="uview__head uview__head--row">
          <div>
            <h2 className="uview__title">Read History</h2>
            <p className="uview__sub">
              Resume where you left off. {totalLogged} {totalLogged === 1 ? 'chapter' : 'chapters'} logged.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-container">
            <p>Loading history...</p>
          </div>
        ) : error ? (
          <div className="empty-state-container">
            <p>{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state-container">
            <p>No reading history available.</p>
          </div>
        ) : (
          <div className="hgrid">
            {items.map((item) => {
              const href = `/comics/${item.comicUrl}/${item.chapterId}`;
              const title = `${item.comicName} · Ch. ${item.chapterNumber ?? '-'}${item.chapterTitle ? ` — ${item.chapterTitle}` : ''}`;
              const imageSrc = getImage(item.coverUrl || '#');
              const progressPercent = item.totalPage ? Math.round((item.currentPage / item.totalPage) * 100) : 0;

              return (
                <HistoryCard
                  key={item.chapterId}
                  href={href}
                  title={title}
                  imageSrc={imageSrc}
                  currentChapter={item.currentPage}
                  totalChapters={item.totalPage}
                  timeAgo={formatTimeAgo(item.readAt)}
                  progressPercent={progressPercent}
                  onRemove={() => handleRemoveItem(item.chapterId)}
                />
              );
            })}
          </div>
        )}

        <div className="uview__pager"></div>
      </div>
    </div>
  );
};