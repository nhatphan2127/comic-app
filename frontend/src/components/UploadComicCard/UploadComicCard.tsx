import React from 'react';
import { Link } from 'react-router-dom';
import type { ComicContributor } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import styles from './UploadComicCard.module.css';

// Helper tạo badge hiển thị trạng thái duyệt đóng góp (dùng cho ComicCard overlay)
const getStatusBadge = (status: 'pending' | 'accept' | 'reject') => {
  if (!status) return null;
  const map: Record<string, string> = {
    pending: `${styles['status-badge']} ${styles['status-pending']}`,
    accept: `${styles['status-badge']} ${styles['status-accept']}`,
    reject: `${styles['status-badge']} ${styles['status-reject']}`,
  };
  const cls = map[status] || styles['status-badge'];
  const label = status === 'pending' ? 'Pending' : status === 'accept' ? 'Accepted' : 'Rejected';
  return <span className={cls}>{label}</span>;
};

interface ComicCardProps {
  contributor: ComicContributor;
}

export function ComicCard({ contributor }: ComicCardProps) {
  const comicData = contributor.comic;
  const title = comicData?.name || 'Unknown Comic';
  const image = getImage(comicData?.coverUrl);
  const url = comicData?.url || contributor.comicId;

  return (
    <Link to={`/comics/${url}`} className={`${styles['card']} ${styles['card--compact']}`}>
      <div className={styles['card__poster-wrap']} style={{ position: 'relative' }}>
        <div className={`${styles['poster']} ${styles['poster--md']}`}>
          <img alt={title} loading="lazy" src={image} />
        </div>
        <div className={styles['card__poster-overlay']}>
          {getStatusBadge(contributor.status)}
        </div>
      </div>
      <div className={styles['card__body']}>
        <div className={styles['card__meta']}>
          {comicData?.demographic && (
            <span className={styles['card__demographic']}>
              {comicData.demographic}
            </span>
          )}
          <span className={styles['card__time']}>
            {formatTimeAgo(contributor.updatedAt)}
          </span>
        </div>
        <div className={styles['card__title']} title={title}>
          {title}
        </div>
        {comicData?.types && (
          <div className={styles['card__types']}>
            Types: {comicData.types}
          </div>
        )}
      </div>
    </Link>
  );
}

interface ComicRowProps {
  contributor: ComicContributor;
  onClick?: () => void | Promise<void>;
  onEdit?: () => void | Promise<void>;
}

export function ComicRow({ contributor, onClick, onEdit }: ComicRowProps) {
  const comicData = contributor.comic;
  const title = comicData?.name || 'Unknown Comic';
  const image = getImage(comicData?.coverUrl);
  const url = comicData?.url || contributor.comicId;

  // Lọc và chuẩn bị danh sách meta hiển thị kèm dấu chấm tròn xen kẽ
  const metaItems: React.ReactNode[] = [];
  
  if (comicData?.releasingStatus) {
    metaItems.push(
      <span key="status" className={`${styles['ulrow__status']} ${styles['ulrow__status--releasing']}`}>
        {comicData.releasingStatus}
      </span>
    );
  }
  
  if (comicData?.types) {
    metaItems.push(
      <span key="types" className={styles['ulrow__text-meta']}>
        {comicData.types}
      </span>
    );
  }
  
  if (comicData?.demographic) {
    metaItems.push(
      <span key="demographic" className={`${styles['ulrow__text-meta']} ${styles['text-capitalize'] || 'text-capitalize'}`}>
        {comicData.demographic}
      </span>
    );
  }
  
  metaItems.push(
    <span key="time" className={styles['card__time']}>
      {formatTimeAgo(contributor.updatedAt)}
    </span>
  );

  // Tạo class động theo thể loại giới hạn độ tuổi
  const contentRatingClass = comicData?.contentRating 
    ? styles[`rating-${comicData.contentRating.toLowerCase()}`] || '' 
    : '';

  return (
    <li className={styles['ulrow']} onClick={onClick}>
      <Link className={styles['ulrow__poster']} to={`/comics/${url}`} aria-label={title}>
        <div className={`${styles['poster']} ${styles['poster--sm']}`}>
          <img alt={title} loading="lazy" src={image} />
        </div>
      </Link>
      
      <div className={styles['ulrow__body']}>
        <Link className={styles['ulrow__title']} to={`/comics/${url}`}>
          {title}
        </Link>
        <div className={styles['ulrow__meta']}>
          {metaItems.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className={styles['ulrow__dot']}></span>}
              {item}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className={styles['ulrow__actions']}>
        {onEdit && (
          <button
            type="button"
            className={`${styles['ubtn']} ${styles['ubtn--ghost']} ${styles['ubtn--sm']}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onEdit();
            }}
            style={{ marginRight: '8px' }}
          >
            Edit
          </button>
        )}

        {/* 1. Trạng thái duyệt đóng góp hiển thị dạng Folder Pill */}
        <span className={`${styles['ulrow__folder']} ${styles[`status-${contributor.status}`] || ''}`}>
          {contributor.status === 'pending' ? 'Pending' : contributor.status === 'accept' ? 'Accepted' : 'Rejected'}
        </span>

        {/* 3. Thể loại contentRating thay thế cho Rating Star */}
        {comicData?.contentRating && (
          <div className={styles['ulrow__rating']}>
            <span className={`${styles['ulrow__rating-btn']} ${styles['is-rated']} ${contentRatingClass}`}>
              {comicData.contentRating}
            </span>
          </div>
        )}

      </div>
    </li>
  );
}