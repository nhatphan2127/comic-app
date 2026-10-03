import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Comic, Chapter } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import { API_UPLOADS } from '../../services/api';
import { getImage } from '../../helpers/getImage';
import styles from './ComicCard.module.css';

interface ComicCardProps {
    onComicSelect?: (comic: Comic) => void;
    comic: Comic;
    viewMode: 'grid' | 'list';
}

interface ComicCardListProps {
    onComicSelect?: (comic: Comic) => void;
    comics: Comic[];
    viewMode: 'grid' | 'list';
}

const ComicCard = memo(({ comic, viewMode, onComicSelect }: ComicCardProps) => {
    const isList = viewMode === 'list';

    const title = comic.name || comic.names?.[0]?.name || 'Unknown';
    const image = comic.coverUrl;
    const url = comic.url;
    const latestChapters = comic.latestChapters ?? [];

    const handleCardClick = (e: React.MouseEvent) => {
        if (onComicSelect) {
            e.preventDefault();
            onComicSelect(comic);
        }
    };

    if (isList) {
        return (
            <div className={`${styles['manga-card']} ${styles['list-mode']}`} style={{ position: 'relative' }}>
                <Link 
                    to={`/comics/${url}`}
                    className={styles['card-overlay-link']}
                    style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                    aria-label={title}
                    onClick={handleCardClick}
                />

                <div className={styles['comic-card-image-wrapper']}>
                    <img 
                        sizes="(max-width: 600px) 100px, 280px" 
                        src={getImage(image)} 
                        alt={title} 
                        className={styles['comic-card-img']} 
                        loading="lazy"
                    />
                </div>

                <div className={styles['card-info']} style={{ position: 'relative', zIndex: 2 }}>
                    <div>
                        <h3 className={styles['card-title']}>{title}</h3>
                        <div className={styles['card-latest-chapters']}>
                            {latestChapters.slice(0, 3).map((item: Chapter) => (
                                <div key={item.id} className={styles['latest-chapter-line']}>
                                    <Link 
                                        className={styles['latest-chapter']} 
                                        to={`/comics/${url}/${item.id}`}
                                        style={{ position: 'relative', zIndex: 3 }}
                                    >
                                        Chapter {item.chapterNumber}
                                    </Link>
                                    <span className={styles['latest-upload']}>
                                        {formatTimeAgo(item.updatedAt || item.createdAt || '')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // CHẾ ĐỘ XEM LƯỚI (GRID VIEW)
    const latestChapter = latestChapters[0];
    const chapterLabel = latestChapter ? `Ch.${latestChapter.chapterNumber}` : 'Ch.New';
    const timeLabel = latestChapter 
        ? formatTimeAgo(latestChapter.updatedAt || latestChapter.createdAt || '') 
        : 'Recently';

    return (
        <div className={styles['card']} style={{ position: 'relative' }}>
            <Link 
                to={`/comics/${url}`} 
                className={styles['card-overlay-link']}
                style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                aria-label={title}
                onClick={handleCardClick}
            />
            
            <div className={styles['card__poster-wrap']}>
                <div className={`${styles['poster']} ${styles['poster--md'] || ''}`}>
                    <img 
                        sizes="(max-width: 600px) 100px, 280px" 
                        alt={title} 
                        loading="lazy" 
                        src={image ? `${API_UPLOADS}${image}` : '/images/placeholder.png'} 
                    />
                </div>
            </div>
            
            <div className={styles['card__body']} style={{ position: 'relative', zIndex: 2 }}>
                <div className={styles['card__meta']}>
                    {latestChapter ? (
                        <Link 
                            to={`/comics/${url}/chapter/${latestChapter.id}`}
                            className={styles['card__ch']}
                            style={{ position: 'relative', zIndex: 3 }}
                        >
                            {chapterLabel}
                        </Link>
                    ) : (
                        <span className={styles['card__ch']}>{chapterLabel}</span>
                    )}
                    <span className={styles['card__time']}>{timeLabel}</span>
                </div>
                <div className={styles['card__title']} title={title}>{title}</div>
            </div>
        </div>
    );
});

ComicCard.displayName = 'ComicCard';

export default function ComicCardList({ comics, viewMode, onComicSelect }: ComicCardListProps) {
    const layoutClass = viewMode === 'list' ? styles['comic-list-layout'] : styles['grid-updates'];

    return (
        <div className={layoutClass}>
            {comics.map((comic) => (
                <ComicCard 
                    key={comic.id} 
                    comic={comic} 
                    viewMode={viewMode} 
                    onComicSelect={onComicSelect} 
                />
            ))}
        </div>
    );
}