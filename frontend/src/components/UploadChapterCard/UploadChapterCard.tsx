import React from 'react';
import { Link } from 'react-router-dom';
import type { ChapterContributor } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import styles from './UploadChapterCard.module.css';

// Helper hiển thị nhãn trạng thái duyệt chương đóng góp (Dành cho ChapterCard overlay)
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
    <Link to={`/chapters/${url}`} className={`${styles['card']} ${styles['card--compact']}`} onClick={onClick}>
      <div className={styles['card__poster-wrap']} style={{ position: 'relative' }}>
        <div className={`${styles['poster']} ${styles['poster--md']}`}>
          <img alt={comicTitle} loading="lazy" src={image} />
        </div>

        <div className={styles['card__poster-overlay']}>
          {getStatusBadge(contributor.status)}
        </div>
      </div>
      <div className={styles['card__body']}>
        <div className={styles['card__meta']}>
          <span className={styles['card__time']}>
            {formatTimeAgo(contributor.updatedAt)}
          </span>
        </div>
        <div className={styles['card__title']} title={comicTitle} style={{ fontWeight: '600' }}>
          {comicTitle}
        </div>
        {chapterData && (
          <div className={styles['card__chapter-meta']}>
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
      <span key="chapter-num" className={styles['ulrow__text-meta']}>
        Chapter {chapterData.chapterNumber}
      </span>
    );
  }

  metaItems.push(
    <span key="time" className={styles['card__time']}>
      {formatTimeAgo(contributor.updatedAt)}
    </span>
  );

  return (
    <li className={`${styles['ulrow']} ${contributor.unread > 0 ? styles['is-unread'] : ''}`} onClick={onClick}>
      <Link className={styles['ulrow__poster']} to={`/chapters/${url}`} aria-label={comicTitle}>
        <div className={`${styles['poster']} ${styles['poster--sm']}`}>
          <img alt={comicTitle} loading="lazy" src={image} />
        </div>
      </Link>
      
      <div className={styles['ulrow__body']}>
        <Link className={styles['ulrow__title']} to={`/chapters/${url}`} style={{ fontWeight: '600' }}>
          {comicTitle}
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

        {/* 1. Trạng thái duyệt đóng góp ở vị trí ulrow__folder */}
        <span className={`${styles['ulrow__folder']} ${styles[`status-${contributor.status}`] || ''}`}>
          {contributor.status === 'pending' ? 'Pending' : contributor.status === 'accept' ? 'Accepted' : 'Rejected'}
        </span>

      </div>
    </li>
  );
}