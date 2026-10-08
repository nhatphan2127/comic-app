import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { ComicContributor } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import Cover from '../Cover/Cover';
import StatusBadge from '../StatusBadge/StatusBadge';
import styles from './UploadComicCard.module.css';

interface ComicRowProps {
  contributor: ComicContributor;
  onEdit?: () => void;
}

/** A comic the current user suggested, with its review status. */
export function ComicRow({ contributor, onEdit }: ComicRowProps) {
  const comic = contributor.comic;
  const title = comic?.name || 'Unknown comic';
  const href = `/comics/${comic?.url || contributor.comicId}`;

  return (
    <li className={styles.row}>
      <Link to={href} aria-label={title}>
        <Cover src={getImage(comic?.coverUrl)} alt={title} size="sm" />
      </Link>

      <div className={styles.body}>
        <Link to={href} className={styles.title}>
          {title}
        </Link>
        <div className={styles.meta}>
          {comic?.types ? <span className="badge badge--brand">{comic.types}</span> : null}
          {comic?.contentRating ? <span className="badge">{comic.contentRating}</span> : null}
          {comic?.demographic ? <span className={styles.cap}>{comic.demographic}</span> : null}
          {comic?.releasingStatus ? <span className={styles.cap}>{comic.releasingStatus}</span> : null}
          <span>{formatTimeAgo(contributor.updatedAt)}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <StatusBadge status={contributor.status} />
        {onEdit ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
            <Pencil size={13} />
            Edit
          </button>
        ) : null}
      </div>
    </li>
  );
}
