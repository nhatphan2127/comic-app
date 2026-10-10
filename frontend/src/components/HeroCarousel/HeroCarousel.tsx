import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Eye, Heart, Trophy } from 'lucide-react';
import type { Comic } from '../../types/types';
import { getImage } from '../../helpers/getImage';
import { formatCount, getComicTitle } from '../../helpers/utils';
import StarRating from '../StarRating/StarRating';
import cx from '../../helpers/cx';
import styles from './HeroCarousel.module.css';

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD = 40;

interface HeroCarouselProps {
  comics: Comic[];
  isLoading?: boolean;
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HeroCarousel({ comics, isLoading = false }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = comics.length;

  // Keep the index valid when the list changes (e.g. content filter switched).
  const active = count ? index % count : 0;

  const goTo = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const prev = () => goTo(active - 1);
  const next = useCallback(() => goTo(active + 1), [goTo, active]);

  useEffect(() => {
    if (count <= 1 || paused || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) next();
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [count, paused, next]);

  if (isLoading && count === 0) {
    return <div className={cx(styles.hero, styles.skeleton)} aria-hidden="true" />;
  }
  if (count === 0) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx > 0 ? prev : next)();
  };

  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label="Popular comics"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      {comics.map((comic, i) => {
        const title = getComicTitle(comic);
        const cover = getImage(comic.coverUrl);
        const isActive = i === active;

        return (
          <article
            key={comic.id}
            className={cx(styles.slide, isActive && styles.slideActive)}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${title}`}
            aria-hidden={!isActive}
            inert={!isActive}
          >
            <div className={styles.backdrop} style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />

            <div className={styles.content}>
              <Link to={`/comics/${comic.url}`} className={styles.coverLink} tabIndex={-1} aria-hidden="true">
                <img src={cover} alt="" className={styles.cover} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
              </Link>

              <div className={styles.info}>
                <span className={styles.eyebrow}>
                  <Trophy size={14} />
                  <span className="mono">#{i + 1}</span> Popular
                </span>

                <h2 className={styles.title}>
                  <Link to={`/comics/${comic.url}`}>{title}</Link>
                </h2>

                <div className={styles.meta}>
                  <StarRating value={comic.rating ?? 0} size={14} />
                  {comic.ratingCount ? (
                    <span className={styles.metaItem}>{formatCount(comic.ratingCount)} ratings</span>
                  ) : null}
                  <span className={styles.metaItem}>
                    <Eye size={14} /> {formatCount(comic.view)}
                  </span>
                  <span className={styles.metaItem}>
                    <Heart size={14} /> {formatCount(comic.follow)}
                  </span>
                </div>

                {comic.genres?.length ? (
                  <ul className={styles.tags}>
                    {comic.types ? <li className={cx(styles.tag, styles.tagType)}>{comic.types}</li> : null}
                    {comic.genres.slice(0, 4).map((genre) => (
                      <li key={genre} className={styles.tag}>
                        {genre}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {comic.description ? <p className={styles.description}>{comic.description}</p> : null}

                <Link to={`/comics/${comic.url}`} className={styles.cta}>
                  <BookOpen size={16} /> Read now
                </Link>
              </div>
            </div>
          </article>
        );
      })}

      {count > 1 ? (
        <>
          <button type="button" className={cx(styles.arrow, styles.arrowPrev)} onClick={prev} aria-label="Previous slide">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className={cx(styles.arrow, styles.arrowNext)} onClick={next} aria-label="Next slide">
            <ChevronRight size={20} />
          </button>

          <div className={styles.dots} role="group" aria-label="Choose slide">
            {comics.map((comic, i) => (
              <button
                key={comic.id}
                type="button"
                className={cx(styles.dot, i === active && styles.dotActive)}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === active ? 'true' : undefined}
              >
                {/* Restart the progress animation on every slide change. */}
                {i === active && !paused ? <span key={active} className={styles.dotProgress} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
