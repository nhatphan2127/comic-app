import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { Comic, RankingPeriod } from '../../types/types';
import { getImage } from '../../helpers/getImage';
import { getComicTitle } from '../../helpers/utils';
import Cover from '../Cover/Cover';
import Segmented, { type SegmentOption } from '../Segmented/Segmented';
import StarRating from '../StarRating/StarRating';
import cx from '../../helpers/cx';
import styles from './PopularCard.module.css';

const MAX_ITEMS = 10;

const PERIODS: SegmentOption<RankingPeriod>[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All time' },
];

interface PopularCardProps {
  comics: Comic[];
  period: RankingPeriod;
  onPeriodChange: (period: RankingPeriod) => void;
  isLoading?: boolean;
}

/** Rankings panel: the most active comics (views, new follows, new ratings) of the chosen period. */
const PopularCard = memo(function PopularCard({ comics, period, onPeriodChange, isLoading = false }: PopularCardProps) {
  return (
    <aside className={styles.panel} aria-labelledby="popular-heading">
      <h2 id="popular-heading" className={styles.heading}>
        <Trophy size={18} className={styles.headingIcon} />
        Rankings
      </h2>

      <Segmented value={period} options={PERIODS} onChange={onPeriodChange} ariaLabel="Ranking period" className={styles.periods} />

      {comics.length === 0 ? (
        <p className={styles.state}>{isLoading ? 'Loading…' : 'No activity in this period yet.'}</p>
      ) : (
        <ol className={cx(styles.list, isLoading && styles.listLoading)} aria-busy={isLoading}>
          {comics.slice(0, MAX_ITEMS).map((comic, index) => {
            const title = getComicTitle(comic);
            const rank = comic.rank ?? index + 1;
            return (
              <li key={comic.id}>
                <Link to={`/comics/${comic.url}`} className={styles.item}>
                  <span className={cx(styles.rank, rank <= 3 && styles.rankTop, 'mono')}>{rank}</span>
                  <Cover src={getImage(comic.coverUrl)} alt={title} size="sm" />
                  <span className={styles.info}>
                    <span className={styles.title}>{title}</span>
                    {comic.genres?.length ? <span className={styles.genres}>{comic.genres.join(' · ')}</span> : null}
                    <StarRating value={Number(comic.rating ?? 0)} size={11} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
});

export default PopularCard;
