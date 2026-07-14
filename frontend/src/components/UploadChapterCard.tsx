import React from 'react';
import { Link } from 'react-router-dom';
import type { ChapterContributor } from '../types/types';
import { formatTimeAgo } from '../helpers/formatDate';
import { getImage } from '../helpers/getImage';

// Helper hiển thị nhãn trạng thái duyệt chương đóng góp (Dành cho ChapterCard overlay)
const getStatusBadge = (status: 'pending' | 'accept' | 'reject') => {
  if (!status) return null;
  const map = {
    pending: 'status-badge status-pending',
    accept: 'status-badge status-accept',
    reject: 'status-badge status-reject',
  } as Record<string, string>;
  const cls = map[status] || 'status-badge';
  const label = status === 'pending' ? 'Pending' : status === 'accept' ? 'Accepted' : 'Rejected';
  return <span className={cls}>{label}</span>;
};

interface ChapterCardProps {
  contributor: ChapterContributor;
  onClick?: () => void;
}

export function ChapterCard({ contributor, onClick }: ChapterCardProps) {
  const comicData = contributor.comic;
  const chapterData = contributor.chapter;
  
  const comicTitle = comicData?.name || 'Unknown Comic';
  const image = getImage(comicData?.coverUrl);
  const url = chapterData?.url || contributor.chapterId;

  return (
    <Link to={`/chapters/${url}`} className="card card--compact" onClick={onClick}>
      <div className="card__poster-wrap" style={{ position: 'relative' }}>
        <div className="poster poster--md">
          <img alt={comicTitle} loading="lazy" src={image} />
        </div>

        <div className="card__poster-overlay">
          {getStatusBadge(contributor.status)}
        </div>
      </div>
      <div className="card__body">
        <div className="card__meta">
          <span className="card__time">
            {formatTimeAgo(contributor.updatedAt)}
          </span>
        </div>
        <div className="card__title" title={comicTitle} style={{ fontWeight: '600' }}>
          {comicTitle}
        </div>
        {chapterData && (
          <div className="card__chapter-meta">
            Chapter {chapterData.chapterNumber}{chapterData.title && ` - ${chapterData.title}`}
          </div>
        )}
      </div>
    </Link>
  );
}

interface ChapterRowProps {
  contributor: ChapterContributor;
  onClick?: () => void;
}

export function ChapterRow({ contributor, onClick }: ChapterRowProps) {
  const comicData = contributor.comic;
  const chapterData = contributor.chapter;
  
  const comicTitle = comicData?.name || 'Unknown Comic';
  const image = getImage(comicData?.coverUrl);
  const url = chapterData?.url || contributor.chapterId;

  // Xây dựng danh sách meta phân tách bởi dấu chấm tròn (ulrow__dot)
  const metaItems: React.ReactNode[] = [];

  if (chapterData) {
    metaItems.push(
      <span key="chapter-num" className="ulrow__text-meta">
        Chapter {chapterData.chapterNumber}
      </span>
    );
  }

  metaItems.push(
    <span key="time" className="card__time">
      {formatTimeAgo(contributor.updatedAt)}
    </span>
  );

  return (
    <li className={`ulrow ${contributor.unread > 0 ? 'is-unread' : ''}`} onClick={onClick}>
      <Link className="ulrow__poster" to={`/chapters/${url}`} aria-label={comicTitle}>
        <div className="poster poster--sm">
          <img alt={comicTitle} loading="lazy" src={image} />
        </div>
      </Link>
      
      <div className="ulrow__body">
        <Link className="ulrow__title" to={`/chapters/${url}`} style={{ fontWeight: '600' }}>
          {comicTitle}
        </Link>
        <div className="ulrow__meta">
          {metaItems.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="ulrow__dot"></span>}
              {item}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="ulrow__actions">

        {/* 1. Trạng thái duyệt đóng góp ở vị trí ulrow__folder */}
        <span className={`ulrow__folder status-${contributor.status}`}>
          {contributor.status === 'pending' ? 'Pending' : contributor.status === 'accept' ? 'Accepted' : 'Rejected'}
        </span>

      </div>
    </li>
  );
}