import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { HistoryItem } from '../../types/types';
import HistoryCard from '../HistoryCard/HistoryCard';
import styles from './ContinueReading.module.css';

const MAX_TITLES = 6;

/** The last chapter of each recently read comic, for logged-in readers on the home page. */
export default function ContinueReading() {
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

  if (items.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="continue-heading">
      <header className={styles.head}>
        <h2 id="continue-heading" className={styles.title}>
          Continue reading
        </h2>
        <Link to="/profile?tab=read-history" className={styles.more}>
          Full history
          <ArrowRight size={14} />
        </Link>
      </header>
      <div className={styles.grid}>
        {items.map((item) => (
          <HistoryCard key={item.chapterId} item={item} />
        ))}
      </div>
    </section>
  );
}
