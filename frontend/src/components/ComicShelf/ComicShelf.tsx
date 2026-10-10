import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Comic } from '../../types/types';
import { ComicCard } from '../ComicCard/ComicCard';
import Cover from '../Cover/Cover';
import cx from '../../helpers/cx';
import styles from './ComicShelf.module.css';

const PLACEHOLDERS = 6;
// A press that moves less than this is a click, not a drag.
const DRAG_THRESHOLD_PX = 5;

interface ComicShelfProps {
  /** id of the heading, for aria-labelledby. */
  headingId: string;
  title: string;
  subtitle?: string;
  comics: Comic[];
  isLoading?: boolean;
  className?: string;
  /**
   * Size the cards as the catalogue grid would in a container this wide (e.g. the "Latest updates" column,
   * so both show cards of the same size). Default: the shelf's own width.
   */
  cardLayoutWidth?: number;
}

/**
 * A horizontal row of comic cards (the same cards as "Latest updates"), e.g. "For you" or "Similar comics".
 * No scrollbar: drag it with the mouse, use the < > buttons, or swipe on touch screens.
 */
export default function ComicShelf({ headingId, title, subtitle, comics, isLoading = false, className, cardLayoutWidth }: ComicShelfProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startScroll: number; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });
  const [cardWidth, setCardWidth] = useState<number | null>(null);

  const updateArrows = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setCanScroll({ back: row.scrollLeft > 1, forward: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 });
  }, []);

  // Cards as wide as in the "Latest updates" grid (repeat(auto-fill, minmax(--card-min, 1fr))): as many
  // columns of at least --card-min as fit, stretched to fill the width.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const style = getComputedStyle(row);
      const width = cardLayoutWidth ?? row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const min = parseFloat(style.getPropertyValue('--card-min')) || 150;
      const gap = parseFloat(style.columnGap) || 0;
      const columns = Math.max(1, Math.floor((width + gap) / (min + gap)));
      setCardWidth((width - (columns - 1) * gap) / columns);
      updateArrows();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [updateArrows, comics.length, cardLayoutWidth]);

  // One press = one screenful of cards.
  const scroll = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({ left: direction * (row.clientWidth + gap), behavior: 'smooth' });
  };

  // Mouse drag to scroll. Touch and pens keep the browser's own swipe scrolling.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !rowRef.current) return;
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startScroll: rowRef.current.scrollLeft, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const row = rowRef.current;
    if (!state || !row || e.pointerId !== state.pointerId) return;
    const dx = e.clientX - state.startX;
    if (!state.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      state.moved = true;
      setIsDragging(true);
      row.setPointerCapture(e.pointerId);
    }
    row.scrollLeft = state.startScroll - dx;
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || e.pointerId !== state.pointerId) return;
    if (rowRef.current?.hasPointerCapture(e.pointerId)) rowRef.current.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    // Keep `moved` until the click that ends the drag has been swallowed.
    if (!state.moved) drag.current = null;
  };

  // Releasing the mouse after a drag must not open the card under it.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
    drag.current = null;
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
          <button
            type="button"
            className={styles.arrow}
            onClick={() => scroll(-1)}
            disabled={!canScroll.back}
            aria-label={`Scroll ${title} back`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => scroll(1)}
            disabled={!canScroll.forward}
            aria-label={`Scroll ${title} forward`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <div
        ref={rowRef}
        className={cx(styles.row, isLoading && styles.rowLoading, isDragging && styles.rowDragging)}
        style={cardWidth ? ({ '--card-w': `${cardWidth}px` } as CSSProperties) : undefined}
        aria-busy={isLoading}
        onScroll={updateArrows}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        // Stop the browser from dragging the cover image or the link instead of the row.
        onDragStart={(e) => e.preventDefault()}
      >
        {showPlaceholders
          ? Array.from({ length: PLACEHOLDERS }, (_, i) => (
              <div key={i} aria-hidden="true">
                <Cover />
              </div>
            ))
          : comics.map((comic) => <ComicCard key={comic.id} comic={comic} viewMode="grid" />)}
      </div>
    </section>
  );
}
