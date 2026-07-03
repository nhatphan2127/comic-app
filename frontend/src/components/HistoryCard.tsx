import React from 'react';

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
  // Tính toán chu vi của vòng tròn tiến trình (r = 17)
  const radius = 17;
  const circumference = 2 * Math.PI * radius; // xấp xỉ 106.814
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  // Kiểm tra xem đã hoàn thành 100% hay chưa
  const isFinished = clampedPercent >= 100;

  const handleRemoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Ngăn trình duyệt chuyển hướng theo thẻ <a> khi click nút xóa
    e.stopPropagation(); // Ngăn chặn sự kiện nổi bọt lên thẻ <a>
    if (onRemove) {
      onRemove(e);
    }
  };

  return (
    <a className="hitem" href={href}>
      <div className="hitem__poster">
        <img alt={title} loading="lazy" src={imageSrc} />
      </div>
      <div className="hitem__body">
        <div className="hitem__title" title={title}>
          {title}
        </div>
        <div className="hitem__meta">
          <span className="hitem__ch">
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
          <span className="hitem__time">{timeAgo}</span>
        </div>
      </div>

      {/* Vòng tròn tiến trình */}
      <svg 
        className={`hring ${isFinished ? 'is-finished' : ''}`} 
        width="36" 
        height="36" 
        viewBox="0 0 36 36" 
        aria-hidden="true"
      >
        <circle
          className="hring__track"
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2"
        />
        <circle
          className="hring__bar"
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
        {isFinished ? (
          /* Hiển thị dấu tích khi đạt 100% */
          <path
            className="hring__check"
            d="M 11.52 18.72 L 16.560000000000002 23.400000000000002 L 25.2 14.4"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          /* Hiển thị số phần trăm khi chưa hoàn thành */
          <text
            className="hring__label"
            x="50%"
            y="52%"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {clampedPercent}
            <tspan className="hring__pct">%</tspan>
          </text>
        )}
      </svg>

      {/* Nút xóa */}
      <button
        type="button"
        className="hitem__remove"
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
    </a>
  );
}