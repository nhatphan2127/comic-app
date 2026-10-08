import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import type { Comic } from '../../types/types';
import { getImage } from '../../helpers/getImage';
import { getComicTitle } from '../../helpers/utils';
import Cover from '../Cover/Cover';
import StarRating from '../StarRating/StarRating';
import cx from '../../helpers/cx';
import styles from './PopularCard.module.css';

const MAX_ITEMS = 10;

interface PopularCardProps {
  popularComics: Comic[];
}

const PopularCard = memo(function PopularCard({ popularComics }: PopularCardProps) {
  return (
    <aside className={styles.panel} aria-labelledby="popular-heading">
      <h2 id="popular-heading" className={styles.heading}>
        <Flame size={18} className={styles.headingIcon} />
        Popular now
      </h2>

      <ol className={styles.list}>
        {popularComics.slice(0, MAX_ITEMS).map((comic, index) => {
          const title = getComicTitle(comic);
          return (
            <li key={comic.id}>
              <Link to={`/comics/${comic.url}`} className={styles.item}>
                <span className={cx(styles.rank, index < 3 && styles.rankTop, 'mono')}>{index + 1}</span>
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
    </aside>
  );
});

export default PopularCard;
