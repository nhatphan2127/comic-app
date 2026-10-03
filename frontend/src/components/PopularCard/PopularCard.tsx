import styles from "./PopularCard.module.css";
import { memo } from "react";
import { Link } from "react-router-dom";
import type { Comic } from "../../types/types";
import { API_UPLOADS } from '../../services/api';
import { Star, StarHalf } from 'lucide-react';

interface PopularCardProps {
    onComicSelect?: (comic: Comic) => void;
    popularComics: Comic[];
}

const PopularCard = memo(({ popularComics }: PopularCardProps) => {

    return (
        <aside className={styles['main-sidebar-column']}>
            {/* POPULAR SECTION */}
            <div className={styles['sidebar-section']}>
                <div className={styles['sidebar-card']}>
                    {/* Header with title and tabs */}
                    <div className={styles['sidebar-header']}>
                        <span className={styles['title']}>Popular</span>
                    </div>

                    {/* Popular comics list */}
                    <div className={styles['popular-list']}>
                        {popularComics.slice(0, 10).map((comic, index) => {
                            const title = comic.name || comic.names?.[0]?.name || 'Unknown';
                            const image = comic.coverUrl;
                            const ratingValue = Number(comic.rating ?? 0);

                            return (
                                <Link
                                    to={`/comics/${comic.url}`}
                                    className={styles['popular-item']}
                                    key={comic.id}
                                >
                                    {/* Thumbnail with rank badge */}
                                    <div className={styles['thumb-wrapper']}>
                                        <div className={styles['popular-img-container']}>
                                            <img
                                                src={image ? `${API_UPLOADS}${image}` : '/images/placeholder.png'}
                                                alt={title}
                                                className={styles['popular-thumb']}
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className={`${styles['rank-circle']} ${styles['overlay']}`}>
                                            {index + 1}
                                        </div>
                                    </div>

                                    {/* Comic info */}
                                    <div className={styles['popular-info']}>
                                        <h4 className={styles['popular-title']}>{title}</h4>
                                        {comic.genres && comic.genres.length > 0 && (
                                            <p className={styles['popular-genres']}>
                                                <span>Genres: </span>
                                                <strong>{comic.genres.join(', ')}</strong>
                                            </p>
                                        )}
                                        <div className={styles['popular-rating']}>
                                            <div
                                                className={styles['stars']}
                                                aria-label={`${ratingValue.toFixed(1)} stars`}
                                                style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
                                            >
                                                {(() => {
                                                    const fullStarsCount = Math.floor(ratingValue) + (ratingValue % 1 >= 0.75 ? 1 : 0);
                                                    const hasHalfStar = ratingValue % 1 >= 0.25 && ratingValue % 1 < 0.75;

                                                    return [0, 1, 2, 3, 4].map((index) => {
                                                        if (index < fullStarsCount) {
                                                            return (
                                                                <Star
                                                                    key={index}
                                                                    size={12}
                                                                    fill="currentColor"
                                                                    strokeWidth={2}
                                                                />
                                                            );
                                                        } else if (index === fullStarsCount && hasHalfStar) {
                                                            return (
                                                                <div
                                                                    key={index}
                                                                    style={{ position: 'relative', display: 'inline-flex', width: '12px', height: '12px' }}
                                                                >
                                                                    <Star
                                                                        size={12}
                                                                        fill="none"
                                                                        strokeWidth={2}
                                                                        style={{ position: 'absolute', top: 0, left: 0 }}
                                                                    />
                                                                    <StarHalf
                                                                        size={12}
                                                                        fill="currentColor"
                                                                        strokeWidth={2}
                                                                        style={{ position: 'absolute', top: 0, left: 0 }}
                                                                    />
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <Star
                                                                    key={index}
                                                                    size={12}
                                                                    fill="none"
                                                                    strokeWidth={2}
                                                                />
                                                            );
                                                        }
                                                    });
                                                })()}
                                            </div>
                                            <span className={styles['rating-score']}>{ratingValue.toFixed(1)}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </aside>
    );
});

PopularCard.displayName = 'PopularCard';

export default PopularCard;