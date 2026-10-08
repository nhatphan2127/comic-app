import { Star } from 'lucide-react';
import cx from '../../helpers/cx';
import styles from './StarRating.module.css';

interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

/** Read-only star rating; partial stars are rendered by clipping a filled layer. */
export default function StarRating({ value, max = 5, size = 12, showValue = true, className }: StarRatingProps) {
  const safe = Math.max(0, Math.min(max, Number(value) || 0));

  return (
    <span className={cx(styles.rating, className)} aria-label={`${safe.toFixed(1)} out of ${max} stars`}>
      <span className={styles.stars} aria-hidden="true">
        {Array.from({ length: max }, (_, i) => {
          const fill = Math.max(0, Math.min(1, safe - i));
          return (
            <span key={i} className={styles.star} style={{ width: size, height: size }}>
              <Star size={size} className={styles.empty} />
              <span className={styles.fillClip} style={{ width: `${fill * 100}%` }}>
                <Star size={size} className={styles.full} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue ? <span className={cx(styles.value, 'mono')}>{safe.toFixed(1)}</span> : null}
    </span>
  );
}
