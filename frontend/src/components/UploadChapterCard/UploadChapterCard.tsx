import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ChapterContributor } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import Cover from '../Cover/Cover';
import StatusBadge from '../StatusBadge/StatusBadge';
import cx from '../../helpers/cx';
import styles from './UploadChapterCard.module.css';

/** A chapter the current user uploaded, with its review status. */
export function ChapterRow({ contributor }: { contributor: ChapterContributor }) {
  const { comic, chapter } = contributor;
  const title = comic?.name || 'Unknown comic';
  // Only link when we know where the chapter lives (the API may omit the comic slug).
  const href = comic?.url ? `/comics/${comic.url}/${contributor.chapterId}` : null;
  const wrap = (node: ReactNode, className?: string) =>
    href ? (
      <Link to={href} className={className}>
        {node}
      </Link>
    ) : (
      <span className={className}>{node}</span>
    );

  return (
    <li className={cx(styles.row, contributor.unread > 0 && styles.unread)}>
      {wrap(<Cover src={getImage(comic?.coverUrl)} alt={title} size="sm" />)}
      <div className={styles.body}>
        {wrap(title, styles.title)}
        <div className={styles.meta}>
          {chapter ? (
            <span>
              Chapter {chapter.chapterNumber}
              {chapter.title ? ` · ${chapter.title}` : ''}
            </span>
          ) : null}
          <span>{formatTimeAgo(contributor.updatedAt)}</span>
        </div>
      </div>
      <StatusBadge status={contributor.status} />
    </li>
  );
}
