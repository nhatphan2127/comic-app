import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Comic } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { getImage } from '../../helpers/getImage';
import { getComicTitle } from '../../helpers/utils';
import Cover from '../Cover/Cover';
import styles from './ComicCard.module.css';

type ViewMode = 'grid' | 'list';

interface ComicCardProps {
  comic: Comic;
  viewMode: ViewMode;
}

const chapterTime = (ch: { updatedAt?: string | null; createdAt?: string | null }) =>
  formatTimeAgo(ch.updatedAt || ch.createdAt);

/** One catalogue card (also used by ComicShelf). */
export const ComicCard = memo(function ComicCard({ comic, viewMode }: ComicCardProps) {
  const title = getComicTitle(comic);
  const comicPath = `/comics/${comic.url}`;
  const chapters = comic.latestChapters ?? [];

  if (viewMode === 'list') {
    return (
      <article className={styles.row}>
        <Link to={comicPath} className={styles.stretched} aria-label={title} />
        <Cover src={getImage(comic.coverUrl)} alt={title} size="md" className={styles.rowCover} />
        <div className={styles.rowBody}>
          <h3 className={styles.rowTitle}>{title}</h3>
          <ul className={styles.chapterList}>
            {chapters.slice(0, 3).map((ch) => (
              <li key={ch.id} className={styles.chapterLine}>
                <Link to={`${comicPath}/${ch.id}`} className={styles.chapterLink}>
                  Chapter {ch.chapterNumber}
                </Link>
                <span className={styles.time}>{chapterTime(ch)}</span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    );
  }

  const latest = chapters[0];

  return (
    <article className={styles.card}>
      <Link to={comicPath} className={styles.stretched} aria-label={title} />
      <Cover src={getImage(comic.coverUrl)} alt={title} className={styles.cardCover}>
        {comic.types ? <span className={styles.badge}>{comic.types}</span> : null}
      </Cover>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle} title={title}>
          {title}
        </h3>
        <div className={styles.cardMeta}>
          {latest ? (
            <Link to={`${comicPath}/${latest.id}`} className={styles.chapterPill}>
              Ch. {latest.chapterNumber}
            </Link>
          ) : (
            <span className={styles.chapterPill}>New</span>
          )}
          <span className={styles.time}>{latest ? chapterTime(latest) : 'Recently'}</span>
        </div>
      </div>
    </article>
  );
});

interface ComicCardListProps {
  comics: Comic[];
  viewMode: ViewMode;
}

export default function ComicCardList({ comics, viewMode }: ComicCardListProps) {
  return (
    <div className={viewMode === 'list' ? styles.list : styles.grid}>
      {comics.map((comic) => (
        <ComicCard key={comic.id} comic={comic} viewMode={viewMode} />
      ))}
    </div>
  );
}
