import { useNavigate } from "react-router-dom";
import type { Comic } from "../types/data";
import { API_UPLOADS } from '../services/api';

interface PopularCardProps {
    onComicSelect?: (comic: Comic) => void;
    popularComics: Comic[];
}

export default function PopularCard({ popularComics }: PopularCardProps) {
    const navigate = useNavigate();

    return (
        <aside className="main-sidebar-column">
            {/* POPULAR SECTION */}
            <div className="sidebar-section">
                <div className="sidebar-card">
                    {/* Header with title and tabs */}
                    <div className='sidebar-header'>
                        <span className='title'>Popular</span>
                        <div className="tabs-container popular-tabs">
                            <button className="tab-btn active">Weekly</button>
                            <button className="tab-btn">Monthly</button>
                            <button className="tab-btn">All Time</button>
                        </div>
                    </div>

                    {/* Popular comics list */}
                    <div className="popular-list">
                        {popularComics.slice(0, 6).map((comic, index) => {
                            const title = comic.name;
                            const image = comic.coverUrl || comic.image;
                            const ratingValue = Number(comic.rating ?? 0);

                            return (
                                <div 
                                    className="popular-item" 
                                    key={comic.id} 
                                    onClick={() => navigate(`/comics/${comic.url}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            navigate(`/comics/${comic.url}`);
                                        }
                                    }}
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
                                        {comic.genres && (
                                            <p className="popular-genres">{comic.genres}</p>
                                        )}
                                        <div className="popular-rating">
                                            <div className="stars" aria-label={`${ratingValue.toFixed(1)} stars`}>
                                                {'⭐'.repeat(Math.max(0, Math.floor(ratingValue / 2)))}
                                            </div>
                                            <span className="rating-score">{ratingValue.toFixed(1)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </aside>
    );
}
