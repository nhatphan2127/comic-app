import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, X } from 'lucide-react';
import type { HistoryItem } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import Cover from '../Cover/Cover';
import cx from '../../helpers/cx';
import styles from './HistoryCard.module.css';

interface HistoryCardProps {
  item: HistoryItem;
  onRemove?: () => void;
}

export default function HistoryCard({ item, onRemove }: HistoryCardProps) {
  const percent = item.totalPage ? Math.min(100, Math.round((item.currentPage / item.totalPage) * 100)) : 0;
  const finished = percent >= 100;

  const remove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <Link to={`/comics/${item.comicUrl}/${item.chapterId}`} className={styles.card}>
      <Cover src={getImage(item.coverUrl)} alt={item.comicName} size="sm" />

      <div className={styles.body}>
        <span className={styles.title} title={item.comicName}>
          {item.comicName}
        </span>
        <span className={styles.chapter}>
          Chapter {item.chapterNumber ?? '–'}
          {item.chapterTitle ? ` · ${item.chapterTitle}` : ''}
        </span>

        <div className={styles.meta}>
          <span className={styles.pages}>
            <BookOpen size={12} />
            {finished ? 'Finished' : `Page ${item.currentPage} / ${item.totalPage}`}
          </span>
          <span>{formatTimeAgo(item.readAt)}</span>
        </div>

        <span className={styles.track} aria-label={`${percent}% read`}>
          <span className={cx(styles.fill, finished && styles.fillDone)} style={{ width: `${percent}%` }} />
        </span>
      </div>

      {onRemove ? (
        <button type="button" className={styles.remove} aria-label={`Remove ${item.comicName} from history`} title="Remove" onClick={remove}>
          <X size={14} />
        </button>
      ) : null}
    </Link>
  );
}
