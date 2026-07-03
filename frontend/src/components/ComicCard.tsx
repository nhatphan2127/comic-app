import { useNavigate } from 'react-router-dom';
import type { Comic } from '../types/data';
import { formatTimeAgo } from '../helpers/formatDate';
import { API_UPLOADS } from '../services/api';
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

function ComicCard({ comic, viewMode }: ComicCardProps) {
    const isList = viewMode === 'list';
    const title = comic.name || comic.name; // Đảm bảo tương thích với cả 2 trường tên
    const image = comic.coverUrl || comic.coverUrl;
    const url = comic.url;
    const latestChapters = comic.latestChapters ?? [];
    const navigate = useNavigate();

    // CHẾ ĐỘ XEM DANH SÁCH (LIST VIEW) - GIỮ NGUYÊN NHƯ CŨ
    if (isList) {
        return (
            <div
                className="manga-card list-mode"
                onClick={() => navigate(`/comics/${url}`)}
                style={{ cursor: 'pointer' }}
            >
                <div className="comic-card-image-wrapper">
                    <img 
                        sizes="(max-width: 600px) 100px, 280px" 
                        src={image ? `${API_UPLOADS}${image}` : '/images/placeholder.png'} 
                        alt={title} 
                        className="comic-card-img" 
                        loading="lazy"
                    />
                </div>

                <div className="card-info">
                    <div>
                        <h3 className="card-title">{title}</h3>
                        <div className="card-latest-chapters">
                            {latestChapters.slice(0, 3).map((item, index) => (
                                <div key={index} className="latest-chapter-line">
                                    <button 
                                        className="latest-chapter" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/comics/${url}/chapter/${item.id}`);
                                        }}
                                    >
                                        Chapter {item.chapterNumber}
                                    </button>
                                    <span className="latest-upload">{formatTimeAgo(item.updatedAt)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // CHẾ ĐỘ XEM LƯỚI (GRID VIEW) - SỬ DỤNG CẤU TRÚC HÌNH ẢNH, NÚT ADD VÀ THÔNG TIN THEO MẪU COMIX
    const latestChapter = latestChapters[0];
    const chapterLabel = latestChapter ? `Ch.${latestChapter.chapterNumber}` : 'Ch.New';
    const timeLabel = latestChapter ? formatTimeAgo(latestChapter.updatedAt) : 'Recently';

    return (
        <a 
            className="card" 
            href={`/comics/${url}`}
            onClick={(e) => {
                e.preventDefault();
                navigate(`/comics/${url}`);
            }}
        >
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
            <div className="card__body">
                <div className="card__meta">
                    <span 
                        className="card__ch"
                        onClick={(e) => {
                            if (latestChapter) {
                                e.stopPropagation();
                                e.preventDefault();
                                navigate(`/comics/${url}/chapter/${latestChapter.id}`);
                            }
                        }}
                    >
                        {chapterLabel}
                    </span>
                    <span className="card__time">{timeLabel}</span>
                </div>
                <div className="card__title" title={title}>{title}</div>
            </div>
        </a>
    );
}

export default function ComicCardList({ comics, viewMode, onComicSelect }: ComicCardListProps) {
    // Nếu ở chế độ grid, đổi lớp layout thành 'grid-updates' để ăn khớp với CSS của Comix
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