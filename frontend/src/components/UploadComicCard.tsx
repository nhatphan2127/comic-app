import React from 'react';
import { Link } from 'react-router-dom';
import type { ComicContributor } from '../types/data';
import { formatTimeAgo } from '../helpers/formatDate';
import { API_UPLOADS } from '../services/api';

// Helper xử lý đường dẫn ảnh bìa
const getImageUrl = (coverUrl?: string) => {
  if (!coverUrl) return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }
  return `${API_UPLOADS}${coverUrl}`;
};

// Helper tạo badge hiển thị trạng thái duyệt đóng góp (dùng cho ComicCard overlay)
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

interface ComicCardProps {
  contributor: ComicContributor;
}

export function ComicCard({ contributor }: ComicCardProps) {
  const comicData = contributor.comic;
  const title = comicData?.name || 'Unknown Comic';
  const image = getImageUrl(comicData?.coverUrl);
  const url = comicData?.url || contributor.comicId;

  return (
    <Link to={`/comics/${url}`} className="card card--compact">
      <div className="card__poster-wrap" style={{ position: 'relative' }}>
        <div className="poster poster--md">
          <img alt={title} loading="lazy" src={image} />
        </div>
        <div className="card__poster-overlay">
          {getStatusBadge(contributor.status)}
          {contributor.unread > 0 && <span className="unread-pill">{contributor.unread} unread</span>}
        </div>
      </div>
      <div className="card__body">
        <div className="card__meta">
          {comicData?.demographic && (
            <span className="card__demographic">
              {comicData.demographic}
            </span>
          )}
          <span className="card__time">
            {formatTimeAgo(contributor.updatedAt)}
          </span>
        </div>
        <div className="card__title" title={title}>
          {title}
        </div>
        {comicData?.types && (
          <div className="card__types">
            Types: {comicData.types}
          </div>
        )}
      </div>
    </Link>
  );
}


interface ComicRowProps {
  contributor: ComicContributor;
}

export function ComicRow({ contributor }: ComicRowProps) {
  const comicData = contributor.comic;
  const title = comicData?.name || 'Unknown Comic';
  const image = getImageUrl(comicData?.coverUrl);
  const url = comicData?.url || contributor.comicId;

  // Lọc và chuẩn bị danh sách meta hiển thị kèm dấu chấm tròn xen kẽ
  const metaItems: React.ReactNode[] = [];
  
  if (comicData?.releasingStatus) {
    metaItems.push(
      <span key="status" className="ulrow__status ulrow__status--releasing">
        {comicData.releasingStatus}
      </span>
    );
  }
  
  if (comicData?.types) {
    metaItems.push(
      <span key="types" className="ulrow__text-meta">
        {comicData.types}
      </span>
    );
  }
  
  if (comicData?.demographic) {
    metaItems.push(
      <span key="demographic" className="ulrow__text-meta text-capitalize">
        {comicData.demographic}
      </span>
    );
  }
  
  metaItems.push(
    <span key="time" className="card__time">
      {formatTimeAgo(contributor.updatedAt)}
    </span>
  );

  // Tạo class động theo thể loại giới hạn độ tuổi
  const contentRatingClass = comicData?.contentRating 
    ? `rating-${comicData.contentRating.toLowerCase()}` 
    : '';

  return (
    <li className="ulrow">
      <Link className="ulrow__poster" to={`/comics/${url}`} aria-label={title}>
        <div className="poster poster--sm">
          <img alt={title} loading="lazy" src={image} />
        </div>
      </Link>
      
      <div className="ulrow__body">
        <Link className="ulrow__title" to={`/comics/${url}`}>
          {title}
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
        {/* 1. Trạng thái duyệt đóng góp hiển thị dạng Folder Pill */}
        <span className={`ulrow__folder status-${contributor.status}`}>
          {contributor.status === 'pending' ? 'Pending' : contributor.status === 'accept' ? 'Accepted' : 'Rejected'}
        </span>

        {/* 3. Thể loại contentRating thay thế cho Rating Star */}
        {comicData?.contentRating && (
          <div className="ulrow__rating">
            <span className={`ulrow__rating-btn is-rated ${contentRatingClass}`}>
              {comicData.contentRating}
            </span>
          </div>
        )}

        {/* Thông báo tin chưa đọc */}
        {contributor.unread > 0 && (
          <span className="unread-pill">{contributor.unread} unread</span>
        )}
      </div>
    </li>
  );
}