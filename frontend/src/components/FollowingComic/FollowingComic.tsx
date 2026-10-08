import { Link } from 'react-router-dom';
import { Bookmark, Folder, MoreHorizontal, Star, Trash2 } from 'lucide-react';
import type { Comic, UserFollowingCategory } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import { getComicTitle } from '../../helpers/utils';
import Cover from '../Cover/Cover';
import Dropdown, { DropdownDivider, DropdownItem, DropdownLabel } from '../Dropdown/Dropdown';
import cx from '../../helpers/cx';
import styles from './FollowingComic.module.css';

interface ComicRowProps {
  comic: Comic;
  categoryId: string | null;
  categoryName?: string | null;
  readChapters?: number;
  totalChapters?: number;
  /** Readable chapters after the furthest one read. */
  unreadChapters?: number;
  latestChapterAt?: string | null;
  categories: UserFollowingCategory[];
  onUnfollow: (id: string) => void;
  onMoveCategory: (comicId: string, categoryId: string | null) => Promise<void>;
}

/** One title in the user's library, with progress and a folder/unfollow menu. */
export function ComicRow({
  comic,
  categoryId,
  categoryName,
  readChapters,
  totalChapters,
  unreadChapters = 0,
  latestChapterAt,
  categories,
  onUnfollow,
  onMoveCategory,
}: ComicRowProps) {
  const title = getComicTitle(comic);
  const href = `/comics/${comic.url}`;
  const percent = totalChapters ? Math.min(100, Math.round(((readChapters ?? 0) / totalChapters) * 100)) : 0;
  const rating = comic.userRating || comic.rating || 0;

  const unfollow = () => {
    if (window.confirm(`Remove "${title}" from your library?`)) onUnfollow(comic.id);
  };

  return (
    <li className={styles.row}>
      <Link to={href} aria-label={title}>
        <Cover src={getImage(comic.coverUrl)} alt={title} size="sm" />
      </Link>

      <div className={styles.body}>
        <Link to={href} className={styles.title}>
          {title}
        </Link>
        {unreadChapters > 0 ? (
          <span className={cx('badge badge--brand', styles.unread)}>
            {unreadChapters} new {unreadChapters === 1 ? 'chapter' : 'chapters'}
          </span>
        ) : null}
        <div className={styles.meta}>
          <span className="badge badge--info">{comic.releaseStatus || 'Releasing'}</span>
          <span className={styles.metaItem}>
            <Bookmark size={12} />
            {readChapters ?? '—'} / {totalChapters ?? '—'}
          </span>
          <span className={styles.metaItem}>{latestChapterAt ? `Updated ${formatTimeAgo(latestChapterAt)}` : 'No chapters yet'}</span>
        </div>
        <span className={styles.track} aria-label={`${percent}% read`}>
          <span style={{ width: `${percent}%` }} />
        </span>
      </div>

      <div className={styles.side}>
        <span className={styles.folder}>
          <Folder size={12} />
          {categoryName || 'Unsorted'}
        </span>
        {rating ? (
          <span className={cx(styles.rating, 'mono')}>
            <Star size={12} />
            {Number(rating).toFixed(1)}
          </span>
        ) : null}

        <Dropdown
          align="right"
          ariaLabel="More options"
          trigger={<MoreHorizontal size={16} />}
          triggerClassName="btn btn--ghost btn--sm btn--icon"
        >
          {(close) => (
            <>
              <DropdownLabel>Move to folder</DropdownLabel>
              <DropdownItem
                kind="radio"
                selected={!categoryId}
                onClick={() => {
                  close();
                  void onMoveCategory(comic.id, null);
                }}
              >
                Unsorted
              </DropdownItem>
              {categories.map((folder) => (
                <DropdownItem
                  key={folder.id}
                  kind="radio"
                  selected={categoryId === folder.id}
                  onClick={() => {
                    close();
                    void onMoveCategory(comic.id, folder.id);
                  }}
                >
                  {folder.category}
                </DropdownItem>
              ))}
              <DropdownDivider />
              <DropdownItem
                danger
                icon={<Trash2 size={14} />}
                onClick={() => {
                  close();
                  unfollow();
                }}
              >
                Remove from library
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>
    </li>
  );
}
