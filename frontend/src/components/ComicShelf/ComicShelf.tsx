import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Comic } from '../../types/types';
import { getImage } from '../../helpers/getImage';
import { getComicTitle } from '../../helpers/utils';
import Cover from '../Cover/Cover';
import cx from '../../helpers/cx';
import styles from './ComicShelf.module.css';

const PLACEHOLDERS = 6;

interface ComicShelfProps {
  /** id of the heading, for aria-labelledby. */
  headingId: string;
  title: string;
  subtitle?: string;
  comics: Comic[];
  /** A short line under each title (why it is recommended, its genres…). */
  caption?: (comic: Comic) => ReactNode;
  isLoading?: boolean;
  className?: string;
}

/** A horizontally scrolling row of comic covers with a heading, e.g. "For you" or "Similar comics". */
export default function ComicShelf({ headingId, title, subtitle, comics, caption, isLoading = false, className }: ComicShelfProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (row) row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: 'smooth' });
  };
  const showPlaceholders = isLoading && comics.length === 0;

  return (
    <section className={cx(styles.section, className)} aria-labelledby={headingId}>
      <header className={styles.head}>
        <div>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <div className={styles.arrows}>
          <button type="button" className={styles.arrow} onClick={() => scroll(-1)} aria-label={`Scroll ${title} back`}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={styles.arrow} onClick={() => scroll(1)} aria-label={`Scroll ${title} forward`}>
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <div ref={rowRef} className={cx(styles.row, isLoading && styles.rowLoading)} aria-busy={isLoading}>
        {showPlaceholders
          ? Array.from({ length: PLACEHOLDERS }, (_, i) => (
              <div key={i} className={styles.card} aria-hidden="true">
                <Cover />
              </div>
            ))
          : comics.map((comic) => {
              const name = getComicTitle(comic);
              return (
                <Link key={comic.id} to={`/comics/${comic.url}`} className={styles.card}>
                  <Cover src={getImage(comic.coverUrl)} alt={name} />
                  <span className={styles.name} title={name}>
                    {name}
                  </span>
                  {caption ? <span className={styles.caption}>{caption(comic)}</span> : null}
                </Link>
              );
            })}
      </div>
    </section>
  );
}
