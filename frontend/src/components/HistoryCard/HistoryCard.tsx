import React from 'react';
import styles from './HistoryCard.module.css';

export interface HistoryCardProps {
  href: string;
  title: string;
  imageSrc: string;
  currentChapter: number;
  totalChapters: number;
  timeAgo: string;
  progressPercent: number;
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function HistoryCard({
    href, title, imageSrc, currentChapter,
    totalChapters, timeAgo, progressPercent, onRemove
}: HistoryCardProps) {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  const isFinished = clampedPercent >= 100;

  const handleRemoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Ngăn trình duyệt chuyển hướng theo thẻ <a> khi click nút xóa
    e.stopPropagation(); // Ngăn chặn sự kiện nổi bọt lên thẻ <a>
    if (onRemove) {
      onRemove(e);
    }
  };

  return (
    <a className={styles['hitem']} href={href}>
      <div className={styles['hitem__poster']}>
        <img alt={title} loading="lazy" src={imageSrc} />
      </div>
      <div className={styles['hitem__body']}>
        <div className={styles['hitem__title']} title={title}>
          {title}
        </div>
        <div className={styles['hitem__meta']}>
          <span className={styles['hitem__ch']}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {currentChapter} / {totalChapters}
          </span>
          <span className={styles['hitem__time']}>{timeAgo}</span>
        </div>
      </div>

      {/* Nút xóa */}
      <button
        type="button"
        className={styles['hitem__remove']}
        aria-label={`Remove ${title} from history`}
        title="Remove from history"
        onClick={handleRemoveClick}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Progress bottom bar */}
      <div className={styles['hitem__progress']}>
        <div
          className={styles['hitem__progress-bar']}
          style={{
            width: `${clampedPercent}%`,
            backgroundColor: isFinished ? 'var(--success)' : 'var(--warning)',
          }}
        />
      </div>
    </a>
  );
}