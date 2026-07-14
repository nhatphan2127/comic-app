import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { Comic, UserFollowingCategory } from '../types/types';
import { formatTimeAgo } from '../helpers/formatDate';
import { API_UPLOADS } from '../services/api';

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
    <Link to={`/comics/${url}`} className="card card--compact">
      <div className="card__poster-wrap" style={{ position: 'relative' }}>
        <div className="poster poster--md">
          <img alt={title} loading="lazy" src={image} />
        </div>
        <button
          className="unfollow-btn-overlay"
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
      <div className="card__body">
        <div className="card__meta">
          <div className="ulrow__progress">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z"></path>
            </svg>
            <span className="card__ch">
              {readedChapter !== undefined ? readedChapter : '—'} / {totalChapters !== undefined ? totalChapters : '—'}
            </span>
          </div>
          <span className="card__time">
            {latestChapter ? formatTimeAgo(latestChapter.updatedAt) : 'Recently updated'}
          </span>
        </div>
        <div className="card__title" title={title}>
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
          <span className="ulrow__status ulrow__status--releasing">
            {comic.releaseStatus || 'Releasing'}
          </span>
          <span className="ulrow__dot"></span>
          <div className="ulrow__progress">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z"></path>
            </svg>
            <span className="card__ch">
              {readedChapter !== undefined ? readedChapter : '—'} / {totalChapters !== undefined ? totalChapters : '—'}
            </span>
          </div>
          <span className="ulrow__dot"></span>
          <span className="card__time">
            {latestChapter ? formatTimeAgo(latestChapter.updatedAt) : 'Recently updated'}
          </span>
        </div>
      </div>
      <div className="ulrow__actions">

        {/* Trạng thái Folder hiện tại */}
        <span className="ulrow__folder">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3h12v18l-6-4-6 4z"></path>
          </svg>
          <span>{comic.categoryName || 'All'}</span>
        </span>

        {/* Rating */}
        <div className="fdrop ulrow__rating">
          <button type="button" className="ulrow__rating-btn is-rated" aria-haspopup="menu" aria-expanded="false">
            <span aria-hidden="true">★</span>
            <span className="mono">{comic.rating || comic.userRating || 0}</span>
          </button>
        </div>

        {/* Dropdown Options */}
        <div className={`fdrop ${isMenuOpen ? 'is-open' : ''}`} ref={menuRef}>
          <button
            type="button"
            className="ubtn ubtn--ghost ubtn--sm"
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
            <div className="fdrop__pop fdrop__pop--menu" role="menu" style={{ right: 0, left: 'auto' }}>
              <div className="fdrop__menu-label">Move to</div>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!comic.followingCategoryId}
                className={`fdrop__item ${!comic.followingCategoryId ? 'is-active' : ''}`}
                onClick={() => void handleMoveCategory(null)}
              >
                <span className="fdrop__item-check" aria-hidden="true">
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
                  className={`fdrop__item ${comic.followingCategoryId === folder.id ? 'is-active' : ''}`}
                  onClick={() => void handleMoveCategory(folder.id)}
                >
                  <span className="fdrop__item-check" aria-hidden="true">
                    {comic.followingCategoryId === folder.id ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 12l5 5L20 6"></path>
                      </svg>
                    ) : null}
                  </span>
                  <span>{folder.category}</span>
                </button>
              ))}
              <div className="fdrop__sep"></div>
              <button
                type="button"
                className="fdrop__item fdrop__item--danger"
                onClick={handleUnfollowClick}
              >
                <span className="fdrop__item-check" aria-hidden="true">
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