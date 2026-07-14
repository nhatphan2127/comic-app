import { memo } from "react";
import { Link } from "react-router-dom";
import type { Comic } from "../types/types";
import { API_UPLOADS } from '../services/api';
import { Star, StarHalf } from 'lucide-react';
interface PopularCardProps {
    onComicSelect?: (comic: Comic) => void;
    popularComics: Comic[];
}

// Bọc bằng React.memo để ngăn chặn re-render thừa khi chuyển trang ở component Main
const PopularCard = memo(({ popularComics }: PopularCardProps) => {

    return (
        <aside className="main-sidebar-column">
            {/* POPULAR SECTION */}
            <div className="sidebar-section">
                <div className="sidebar-card">
                    {/* Header with title and tabs */}
                    <div className='sidebar-header'>
                        <span className='title'>Popular</span>
                    </div>

                    {/* Popular comics list */}
                    <div className="popular-list">
                        {popularComics.slice(0, 10).map((comic, index) => {
                            // Tối ưu hóa việc lấy tên và ảnh khớp với Comic Interface của bạn
                            const title = comic.name || comic.names?.[0]?.name || 'Unknown';
                            const image = comic.coverUrl;
                            const ratingValue = Number(comic.rating ?? 0);

                            return (
                                // Chuyển từ div thành Link giúp tối ưu SEO, hỗ trợ click chuột giữa
                                <Link
                                    to={`/comics/${comic.url}`}
                                    className="popular-item"
                                    key={comic.id}
                                >
                                    {/* Thumbnail with rank badge */}
                                    <div className="thumb-wrapper">
                                        <div className="popular-img-container">
                                            <img
                                                src={image ? `${API_UPLOADS}${image}` : '/images/placeholder.png'}
                                                alt={title}
                                                className="popular-thumb"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className={`rank-circle overlay`}>
                                            {index + 1}
                                        </div>
                                    </div>

                                    {/* Comic info */}
                                    <div className="popular-info">
                                        <h4 className="popular-title">{title}</h4>
                                        {comic.genres && comic.genres.length > 0 && (
                                            <p className="popular-genres">
                                                <span>Genres: </span>
                                                <strong>{comic.genres.join(', ')}</strong>
                                            </p>
                                        )}
                                        <div className="popular-rating">
                                            {/* Hiển thị sao có hỗ trợ nửa ngôi sao */}
                                            <div
                                                className="stars"
                                                aria-label={`${ratingValue.toFixed(1)} stars`}
                                                style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
                                            >
                                                {(() => {
                                                    // Xác định số lượng sao đầy (làm tròn lên 1 sao nếu phần lẻ >= 0.75)
                                                    const fullStarsCount = Math.floor(ratingValue) + (ratingValue % 1 >= 0.75 ? 1 : 0);
                                                    // Xác định xem có cần vẽ 1 nửa ngôi sao hay không (phần lẻ nằm trong khoảng 0.25 đến dưới 0.75)
                                                    const hasHalfStar = ratingValue % 1 >= 0.25 && ratingValue % 1 < 0.75;

                                                    return [0, 1, 2, 3, 4].map((index) => {
                                                        if (index < fullStarsCount) {
                                                            // 1. Ngôi sao đầy màu
                                                            return (
                                                                <Star
                                                                    key={index}
                                                                    size={12}
                                                                    fill="currentColor"
                                                                    strokeWidth={2}
                                                                />
                                                            );
                                                        } else if (index === fullStarsCount && hasHalfStar) {
                                                            // 2. Ngôi sao nửa màu (Xếp chồng StarHalf lên trên viền Star rỗng)
                                                            return (
                                                                <div
                                                                    key={index}
                                                                    style={{ position: 'relative', display: 'inline-flex', width: '12px', height: '12px' }}
                                                                >
                                                                    {/* Ngôi sao rỗng làm nền viền ngoài */}
                                                                    <Star
                                                                        size={12}
                                                                        fill="none"
                                                                        strokeWidth={2}
                                                                        style={{ position: 'absolute', top: 0, left: 0 }}
                                                                    />
                                                                    {/* Nửa ngôi sao tô màu đè lên phía trước */}
                                                                    <StarHalf
                                                                        size={12}
                                                                        fill="currentColor"
                                                                        strokeWidth={2}
                                                                        style={{ position: 'absolute', top: 0, left: 0 }}
                                                                    />
                                                                </div>
                                                            );
                                                        } else {
                                                            // 3. Ngôi sao rỗng
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
                                            <span className="rating-score">{ratingValue.toFixed(1)}</span>
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