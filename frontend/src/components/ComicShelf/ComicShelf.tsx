import { Children, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
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
  comics?: Comic[];
  /** Cards to show instead of `comics` (e.g. history cards). */
  children?: ReactNode;
  /** Extra header content next to the arrows, e.g. a "See all" link. Stays visible on phones. */
  action?: ReactNode;
  /** Narrowest card width in px, for cards other than the catalogue's. Default: the catalogue grid's. */
  cardMinWidth?: number;
  isLoading?: boolean;
  className?: string;
  /**
   * Size the cards as the catalogue grid would in a container this wide (e.g. the "Latest updates" column,
   * so both show cards of the same size). Default: the shelf's own width.
   */
  cardLayoutWidth?: number;
  /**
   * Turn a page by itself every this many milliseconds, back to the start after the last page.
   * Pauses while the mouse is over the shelf, while it has keyboard focus, and for a while after the reader
   * scrolls it. Off by default and for readers who prefer reduced motion.
   */
  autoScrollMs?: number;
}

/**
 * A horizontal row of cards: comic cards (the same as "Latest updates"), e.g. "For you" or "Similar comics",
 * or any cards passed as children, e.g. "Continue reading".
 * No scrollbar: drag it with the mouse, use the < > buttons, or swipe on touch screens.
 */
export default function ComicShelf({
  headingId,
  title,
  subtitle,
  comics = [],
  children,
  action,
  cardMinWidth,
  isLoading = false,
  className,
  cardLayoutWidth,
  autoScrollMs,
}: ComicShelfProps) {
  const itemCount = children === undefined ? comics.length : Children.count(children);
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startScroll: number; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  // When the reader last scrolled the shelf themselves; auto-scroll waits a full interval after it.
  const lastInteraction = useRef(0);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false, overflow: false });
  const [cardWidth, setCardWidth] = useState<number | null>(null);

  const updateArrows = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setCanScroll({
      back: row.scrollLeft > 1,
      forward: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
      overflow: row.scrollWidth > row.clientWidth + 1,
    });
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
  }, [updateArrows, itemCount, cardLayoutWidth, cardMinWidth]);

  // One press = one screenful of cards. Pressing > at the end glides back to the first card.
  const scroll = useCallback((direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
    if (direction === 1 && atEnd) {
      row.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    const style = getComputedStyle(row);
    const gap = parseFloat(style.columnGap) || 0;
    const page = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + gap;
    row.scrollBy({ left: direction * page, behavior: 'smooth' });
  }, []);

  const scrollByReader = (direction: 1 | -1) => {
    lastInteraction.current = Date.now();
    scroll(direction);
  };

  useEffect(() => {
    if (!autoScrollMs || isLoading || isHovered || hasKeyboardFocus || isDragging) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden || Date.now() - lastInteraction.current < autoScrollMs) return;
      scroll(1);
    }, autoScrollMs);
    return () => window.clearInterval(timer);
  }, [autoScrollMs, isLoading, isHovered, hasKeyboardFocus, isDragging, scroll]);

  // Mouse drag to scroll. Touch and pens keep the browser's own swipe scrolling.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    lastInteraction.current = Date.now();
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

  const showPlaceholders = isLoading && itemCount === 0;
  const rowStyle = {
    ...(cardMinWidth ? { '--card-min': `${cardMinWidth}px` } : {}),
    ...(cardWidth ? { '--card-w': `${cardWidth}px` } : {}),
  } as CSSProperties;

  return (
    <section
      className={cx(styles.section, className)}
      aria-labelledby={headingId}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setIsHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setIsHovered(false)}
      onFocus={(e) => setHasKeyboardFocus(e.target.matches(':focus-visible'))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHasKeyboardFocus(false);
      }}
    >
      <header className={styles.head}>
        <div>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <div className={styles.tools}>
          {action}
          <div className={styles.arrows}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollByReader(-1)}
              disabled={!canScroll.back}
              aria-label={`Scroll ${title} back`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollByReader(1)}
              disabled={!canScroll.overflow}
              aria-label={canScroll.forward ? `Scroll ${title} forward` : `Back to the start of ${title}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={rowRef}
        className={cx(styles.row, isLoading && styles.rowLoading, isDragging && styles.rowDragging)}
        style={rowStyle}
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
          : (children ?? comics.map((comic) => <ComicCard key={comic.id} comic={comic} viewMode="grid" />))}
      </div>
    </section>
  );
}
