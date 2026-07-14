import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Comic, Chapter } from '../types/types';
import { formatTimeAgo } from '../helpers/formatDate';
import { API_UPLOADS } from '../services/api';
import { getImage } from '../helpers/getImage';

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

    // Xử lý an toàn dữ liệu đầu vào dựa trên Interface Comic
    const title = comic.name || comic.names?.[0]?.name || 'Unknown';
    const image = comic.coverUrl;
    const url = comic.url;
    const latestChapters = comic.latestChapters ?? [];

    // Xử lý sự kiện khi có callback onComicSelect từ component cha
    const handleCardClick = (e: React.MouseEvent) => {
        if (onComicSelect) {
            e.preventDefault(); // Chặn hành vi chuyển hướng của Link mặc định để chạy callback
            onComicSelect(comic);
        }
    };

    // CHẾ ĐỘ XEM DANH SÁCH (LIST VIEW)
    if (isList) {
        return (
            <div className="manga-card list-mode" style={{ position: 'relative' }}>
                {/* Overlay Link: Phủ toàn bộ diện tích Card để người dùng click chuyển trang */}
                <Link 
                    to={`/comics/${url}`}
                    className="card-overlay-link"
                    style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                    aria-label={title}
                    onClick={handleCardClick}
                />

                <div className="comic-card-image-wrapper">
                    <img 
                        sizes="(max-width: 600px) 100px, 280px" 
                        src={getImage(image)} 
                        alt={title} 
                        className="comic-card-img" 
                        loading="lazy"
                    />
                </div>

                {/* zIndex: 2 giúp nội dung hiển thị nằm trên lớp Overlay Link */}
                <div className="card-info" style={{ position: 'relative', zIndex: 2 }}>
                    <div>
                        <h3 className="card-title">{title}</h3>
                        <div className="card-latest-chapters">
                            {latestChapters.slice(0, 3).map((item: Chapter) => (
                                <div key={item.id} className="latest-chapter-line">
                                    {/* Dùng Link thật thay vì button, zIndex: 3 để nằm đè lên Overlay cha */}
                                    <Link 
                                        className="latest-chapter" 
                                        to={`/comics/${url}/${item.id}`}
                                        style={{ position: 'relative', zIndex: 3 }}
                                    >
                                        Chapter {item.chapterNumber}
                                    </Link>
                                    <span className="latest-upload">
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
        <div className="card" style={{ position: 'relative' }}>
            {/* Overlay Link: Phủ toàn bộ Grid Card, hỗ trợ click chuột giữa mở tab mới tốt cho SEO */}
            <Link 
                to={`/comics/${url}`} 
                className="card-overlay-link"
                style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                aria-label={title}
                onClick={handleCardClick}
            />
            
            <div className="card__poster-wrap">
                <div className="poster poster--md">
                    <img 
                        sizes="(max-width: 600px) 100px, 280px" 
                        alt={title} 
                        loading="lazy" 
                        src={image ? `${API_UPLOADS}${image}` : '/images/placeholder.png'} 
                    />
                </div>
            </div>
            
            <div className="card__body" style={{ position: 'relative', zIndex: 2 }}>
                <div className="card__meta">
                    {latestChapter ? (
                        /* Đè lên lớp phủ chính bằng zIndex: 3 để click riêng biệt được vào Chapter */
                        <Link 
                            to={`/comics/${url}/chapter/${latestChapter.id}`}
                            className="card__ch"
                            style={{ position: 'relative', zIndex: 3 }}
                        >
                            {chapterLabel}
                        </Link>
                    ) : (
                        <span className="card__ch">{chapterLabel}</span>
                    )}
                    <span className="card__time">{timeLabel}</span>
                </div>
                <div className="card__title" title={title}>{title}</div>
            </div>
        </div>
    );
});

ComicCard.displayName = 'ComicCard';

export default function ComicCardList({ comics, viewMode, onComicSelect }: ComicCardListProps) {
    const layoutClass = viewMode === 'list' ? 'comic-list-layout' : 'grid-updates';

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