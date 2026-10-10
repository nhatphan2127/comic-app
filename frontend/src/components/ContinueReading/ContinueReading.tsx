import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { HistoryItem } from '../../types/types';
import ComicShelf from '../ComicShelf/ComicShelf';
import HistoryCard from '../HistoryCard/HistoryCard';
import styles from './ContinueReading.module.css';

const MAX_TITLES = 12;
// Narrowest history card: room for the cover, the title and the progress line.
const CARD_MIN_WIDTH = 280;
// A little slower than "You might like", so the two shelves do not slide in step.
const AUTO_SCROLL_MS = 8000;

interface ContinueReadingProps {
  className?: string;
}

/** The last chapter of each recently read comic, for logged-in readers on the home page. */
export default function ContinueReading({ className }: ContinueReadingProps) {
  const { isLoggedIn } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!isLoggedIn) {
      setItems([]);
      return;
    }
    let cancelled = false;
    userApi
      .getReadingHistory()
      .then((history) => {
        if (cancelled) return;
        // History is newest first, so the first entry per comic is where the reader left off.
        const seen = new Set<string>();
        const latest = history.filter((h) => !seen.has(h.comicUrl) && seen.add(h.comicUrl));
        setItems(latest.slice(0, MAX_TITLES));
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  if (!isLoggedIn || items.length === 0) return null;

  return (
    <ComicShelf
      headingId="continue-heading"
      title="Continue reading"
      subtitle="Pick up where you left off"
      className={className}
      cardMinWidth={CARD_MIN_WIDTH}
      autoScrollMs={AUTO_SCROLL_MS}
      action={
        <Link to="/profile?tab=read-history" className={styles.more}>
          Full history
          <ArrowRight size={14} />
        </Link>
      }
    >
      {items.map((item) => (
        <HistoryCard key={item.chapterId} item={item} />
      ))}
    </ComicShelf>
  );
}
