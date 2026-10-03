import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { Comic, UserFollowingCategory } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { API_UPLOADS } from '../../services/api';
import styles from './FollowingComic.module.css';

interface ComicCardProps {
  comic: Comic;
  readedChapter?: number;
  totalChapters?: number;
  onUnfollow: (id: string) => void;
}

export function ComicCard({ comic, readedChapter, totalChapters, onUnfollow }: ComicCardProps) {
  const title = comic.name || comic.names?.[0]?.name || 'Untitled';

  // Kiểm tra nếu coverUrl là url tuyệt đối thì dùng luôn, không thì ghép với API_UPLOADS
  const image = comic.coverUrl
    ? (comic.coverUrl.startsWith('http') ? comic.coverUrl : `${API_UPLOADS}${comic.coverUrl}`)
    : 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';

  const url = comic.url;
  const latestChapter = comic.latestChapters?.[0];

  const handleUnfollowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Do you want to unfollow "${title}"?`)) {
      onUnfollow(comic.id);
    }
  };

  return (
    <Link to={`/comics/${url}`} className={`${styles['card']} ${styles['card--compact']}`}>
      <div className={styles['card__poster-wrap']} style={{ position: 'relative' }}>
        <div className={`${styles['poster']} ${styles['poster--md']}`}>
          <img alt={title} loading="lazy" src={image} />
        </div>
        <button
          className={styles['unfollow-btn-overlay'] || 'unfollow-btn-overlay'}
          onClick={handleUnfollowClick}
          title="Unfollow"
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: 'rgba(0, 0, 0, 0.65)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 5
          }}
        >
          <X size={12} />
        </button>
      </div>
      <div className={styles['card__body']}>
        <div className={styles['card__meta']}>
          <div className={styles['ulrow__progress']}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z"></path>
            </svg>
            <span className={styles['card__ch']}>
              {readedChapter !== undefined ? readedChapter : '—'} / {totalChapters !== undefined ? totalChapters : '—'}
            </span>
          </div>
          <span className={styles['card__time']}>
            {latestChapter ? formatTimeAgo(latestChapter.updatedAt) : 'Recently updated'}
          </span>
        </div>
        <div className={styles['card__title']} title={title}>
          {title}
        </div>
      </div>
    </Link>
  );
}


interface ComicRowProps {
  comic: Comic & { followingCategoryId?: string | null; categoryName?: string | null };
  readedChapter?: number;
  totalChapters?: number;
  onUnfollow: (id: string) => void;
  categories: UserFollowingCategory[];
  onMoveCategory: (comicId: string, categoryId: string | null) => Promise<void>;
}

export function ComicRow({
  comic,
  readedChapter,
  totalChapters,
  onUnfollow,
  categories,
  onMoveCategory
}: ComicRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = comic.name || comic.names?.[0]?.name || 'Untitled';

  const image = comic.coverUrl
    ? (comic.coverUrl.startsWith('http') ? comic.coverUrl : `${API_UPLOADS}${comic.coverUrl}`)
    : 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';

  const url = comic.url;
  const latestChapter = comic.latestChapters?.[0];

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUnfollowClick = () => {
    setIsMenuOpen(false);
    if (window.confirm(`Do you want to unfollow "${title}"?`)) {
      onUnfollow(comic.id);
    }
  };

  const handleMoveCategory = async (categoryId: string | null) => {
    setIsMenuOpen(false);
    await onMoveCategory(comic.id, categoryId);
  };

  return (
    <li className={styles['ulrow']}>
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
          <span className={`${styles['ulrow__status']} ${styles['ulrow__status--releasing']}`}>
            {comic.releaseStatus || 'Releasing'}
          </span>
          <span className={styles['ulrow__dot']}></span>
          <div className={styles['ulrow__progress']}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z"></path>
            </svg>
            <span className={styles['card__ch']}>
              {readedChapter !== undefined ? readedChapter : '—'} / {totalChapters !== undefined ? totalChapters : '—'}
            </span>
          </div>
          <span className={styles['ulrow__dot']}></span>
          <span className={styles['card__time']}>
            {latestChapter ? formatTimeAgo(latestChapter.updatedAt) : 'Recently updated'}
          </span>
        </div>
      </div>
      <div className={styles['ulrow__actions']}>

        {/* Trạng thái Folder hiện tại */}
        <span className={styles['ulrow__folder']}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3h12v18l-6-4-6 4z"></path>
          </svg>
          <span>{comic.categoryName || 'All'}</span>
        </span>

        {/* Rating */}
        <div className={`${styles['fdrop']} ${styles['ulrow__rating']}`}>
          <button type="button" className={`${styles['ulrow__rating-btn']} ${styles['is-rated']}`} aria-haspopup="menu" aria-expanded="false">
            <span aria-hidden="true">★</span>
            <span className={styles['mono'] || 'mono'}>{comic.rating || comic.userRating || 0}</span>
          </button>
        </div>

        {/* Dropdown Options */}
        <div className={`${styles['fdrop']} ${isMenuOpen ? styles['is-open'] : ''}`} ref={menuRef}>
          <button
            type="button"
            className={`${styles['ubtn']} ${styles['ubtn--ghost']} ${styles['ubtn--sm']}`}
            aria-label="More options"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="5" cy="12" r="1.2"></circle>
              <circle cx="12" cy="12" r="1.2"></circle>
              <circle cx="19" cy="12" r="1.2"></circle>
            </svg>
          </button>

          {isMenuOpen && (
            <div className={`${styles['fdrop__pop']} ${styles['fdrop__pop--menu']}`} role="menu" style={{ right: 0, left: 'auto' }}>
              <div className={styles['fdrop__menu-label']}>Move to</div>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!comic.followingCategoryId}
                className={`${styles['fdrop__item']} ${!comic.followingCategoryId ? styles['is-active'] : ''}`}
                onClick={() => void handleMoveCategory(null)}
              >
                <span className={styles['fdrop__item-check']} aria-hidden="true">
                  {!comic.followingCategoryId ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 12l5 5L20 6"></path>
                    </svg>
                  ) : null}
                </span>
                <span>All</span>
              </button>
              {categories.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={comic.followingCategoryId === folder.id}
                  className={`${styles['fdrop__item']} ${comic.followingCategoryId === folder.id ? styles['is-active'] : ''}`}
                  onClick={() => void handleMoveCategory(folder.id)}
                >
                  <span className={styles['fdrop__item-check']} aria-hidden="true">
                    {comic.followingCategoryId === folder.id ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 12l5 5L20 6"></path>
                      </svg>
                    ) : null}
                  </span>
                  <span>{folder.category}</span>
                </button>
              ))}
              <div className={styles['fdrop__sep']}></div>
              <button
                type="button"
                className={`${styles['fdrop__item']} ${styles['fdrop__item--danger']}`}
                onClick={handleUnfollowClick}
              >
                <span className={styles['fdrop__item-check']} aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path>
                  </svg>
                </span>
                <span>Remove from library</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}