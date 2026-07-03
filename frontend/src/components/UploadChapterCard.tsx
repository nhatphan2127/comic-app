// import React from 'react';
// import { Link } from 'react-router-dom';
// import type { ChapterContributor } from '../types/data';
// import { formatTimeAgo } from '../helpers/formatDate';
// import { API_UPLOADS } from '../services/api';

// // Helper xử lý đường dẫn ảnh bìa của truyện
// const getImageUrl = (coverUrl?: string) => {
//   if (!coverUrl) return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';
//   if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
//     return coverUrl;
//   }
//   return `${API_UPLOADS}${coverUrl}`;
// };

// // Helper hiển thị nhãn trạng thái duyệt chương đóng góp
// const getStatusBadge = (status: 'pending' | 'accept' | 'reject') => {
//   if (!status) return null;
//   const map = {
//     pending: 'status-badge status-pending',
//     accept: 'status-badge status-accept',
//     reject: 'status-badge status-reject',
//   } as Record<string, string>;
//   const cls = map[status] || 'status-badge';
//   const label = status === 'pending' ? 'Pending' : status === 'accept' ? 'Accepted' : 'Rejected';
//   return <span className={cls}>{label}</span>;
// };

// interface ChapterCardProps {
//   contributor: ChapterContributor;
//   onClick?: () => void; // Thêm prop onClick nhận diện hành động từ Panel
// }

// export function ChapterCard({ contributor, onClick }: ChapterCardProps) {
//   const comicData = contributor.comic;
//   const chapterData = contributor.chapter;
  
//   const comicTitle = comicData?.name || 'Unknown Comic';
//   const image = getImageUrl(comicData?.coverUrl);
//   const url = chapterData?.url || contributor.chapterId;

//   return (
//     <Link to={`/chapters/${url}`} className="card card--compact" onClick={onClick}>
//       <div className="card__poster-wrap">
//         <div className="poster poster--md">
//           <img alt={comicTitle} loading="lazy" src={image} />
//         </div>

//         <div className="card__poster-overlay">
//           {getStatusBadge(contributor.status)}
//           {contributor.unread > 0 && <span className="unread-pill">{contributor.unread} unread</span>}
//         </div>
//       </div>
//       <div className="card__body">
//         <div className="card__meta">
//           <span className="card__time">
//             {formatTimeAgo(contributor.createdAt)}
//           </span>
//         </div>
//         <div className="card__title" title={comicTitle} style={{ fontWeight: 'bold' }}>
//           {comicTitle}
//         </div>
//         {chapterData && (
//           <div className="card__chapter-meta">Chapter {chapterData.chapterNumber}{chapterData.title && ` - ${chapterData.title}`}</div>
//         )}
//       </div>
//     </Link>
//   );
// }

// interface ChapterRowProps {
//   contributor: ChapterContributor;
//   onClick?: () => void; // Thêm prop onClick nhận diện hành động từ Panel
// }

// export function ChapterRow({ contributor, onClick }: ChapterRowProps) {
//   const comicData = contributor.comic;
//   const chapterData = contributor.chapter;
  
//   const comicTitle = comicData?.name || 'Unknown Comic';
//   const image = getImageUrl(comicData?.coverUrl);
//   const url = chapterData?.url || contributor.chapterId;

//   return (
//     <li className={`ulrow ${contributor.unread > 0 ? 'is-unread' : ''}`} onClick={onClick}>
//       <div className="ulrow__left">
//         <Link className="ulrow__poster" to={`/chapters/${url}`} aria-label={comicTitle}>
//           <div className="poster poster--sm">
//             <img alt={comicTitle} loading="lazy" src={image} />
//           </div>
//         </Link>
//         <div className="ulrow__body">
//           <Link className="ulrow__title" to={`/chapters/${url}`} style={{ fontWeight: '600' }}>
//             {comicTitle}
//           </Link>
//           <div className="ulrow__meta">
//             {/* Nhãn trạng thái duyệt đóng góp */}
//             {getStatusBadge(contributor.status)}
            
//             <span className="ulrow__dot"></span>
            
//             {chapterData && (
//               <>
//                 <span style={{ fontSize: '11px', color: '#9ca3af' }}>
//                   Chapter {chapterData.chapterNumber}
//                 </span>
//                 <span className="ulrow__dot"></span>
//               </>
//             )}
            
//             <span className="card__time" style={{ fontSize: '11px', color: '#9ca3af' }}>
//               Submitted {formatTimeAgo(contributor.createdAt)}
//             </span>
//           </div>
//         </div>
//       </div>
      
//       <div className="ulrow__actions">
//         {/* Tên tiêu đề phụ của chương (nếu có) */}
//         {chapterData?.title && (
//           <span className="chapter-title-pill" title={chapterData.title}>{chapterData.title}</span>
//         )}

//         {/* Số tin chưa đọc */}
//         {contributor.unread > 0 && (
//           <span className="unread-pill">{contributor.unread} unread</span>
//         )}
//       </div>
//     </li>
//   );
// }


import React from 'react';
import { Link } from 'react-router-dom';
import type { ChapterContributor } from '../types/data';
import { formatTimeAgo } from '../helpers/formatDate';
import { API_UPLOADS } from '../services/api';

// Helper xử lý đường dẫn ảnh bìa của truyện
const getImageUrl = (coverUrl?: string) => {
  if (!coverUrl) return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }
  return `${API_UPLOADS}${coverUrl}`;
};

// Helper hiển thị nhãn trạng thái duyệt chương đóng góp (Dành cho ChapterCard overlay)
const getStatusBadge = (status: 'pending' | 'accept' | 'reject') => {
  if (!status) return null;
  const map = {
    pending: 'status-badge status-pending',
    accept: 'status-badge status-accept',
    reject: 'status-badge status-reject',
  } as Record<string, string>;
  const cls = map[status] || 'status-badge';
  const label = status === 'pending' ? 'Pending' : status === 'accept' ? 'Accepted' : 'Rejected';
  return <span className={cls}>{label}</span>;
};

interface ChapterCardProps {
  contributor: ChapterContributor;
  onClick?: () => void;
}

export function ChapterCard({ contributor, onClick }: ChapterCardProps) {
  const comicData = contributor.comic;
  const chapterData = contributor.chapter;
  
  const comicTitle = comicData?.name || 'Unknown Comic';
  const image = getImageUrl(comicData?.coverUrl);
  const url = chapterData?.url || contributor.chapterId;

  return (
    <Link to={`/chapters/${url}`} className="card card--compact" onClick={onClick}>
      <div className="card__poster-wrap" style={{ position: 'relative' }}>
        <div className="poster poster--md">
          <img alt={comicTitle} loading="lazy" src={image} />
        </div>

        <div className="card__poster-overlay">
          {getStatusBadge(contributor.status)}
          {contributor.unread > 0 && <span className="unread-pill">{contributor.unread} unread</span>}
        </div>
      </div>
      <div className="card__body">
        <div className="card__meta">
          <span className="card__time">
            {formatTimeAgo(contributor.updatedAt)}
          </span>
        </div>
        <div className="card__title" title={comicTitle} style={{ fontWeight: '600' }}>
          {comicTitle}
        </div>
        {chapterData && (
          <div className="card__chapter-meta">
            Chapter {chapterData.chapterNumber}{chapterData.title && ` - ${chapterData.title}`}
          </div>
        )}
      </div>
    </Link>
  );
}

interface ChapterRowProps {
  contributor: ChapterContributor;
  onClick?: () => void;
}

export function ChapterRow({ contributor, onClick }: ChapterRowProps) {
  const comicData = contributor.comic;
  const chapterData = contributor.chapter;
  
  const comicTitle = comicData?.name || 'Unknown Comic';
  const image = getImageUrl(comicData?.coverUrl);
  const url = chapterData?.url || contributor.chapterId;

  // Xây dựng danh sách meta phân tách bởi dấu chấm tròn (ulrow__dot)
  const metaItems: React.ReactNode[] = [];

  if (chapterData) {
    metaItems.push(
      <span key="chapter-num" className="ulrow__text-meta">
        Chapter {chapterData.chapterNumber}
      </span>
    );
  }

  metaItems.push(
    <span key="time" className="card__time">
      {formatTimeAgo(contributor.updatedAt)}
    </span>
  );

  return (
    <li className={`ulrow ${contributor.unread > 0 ? 'is-unread' : ''}`} onClick={onClick}>
      <Link className="ulrow__poster" to={`/chapters/${url}`} aria-label={comicTitle}>
        <div className="poster poster--sm">
          <img alt={comicTitle} loading="lazy" src={image} />
        </div>
      </Link>
      
      <div className="ulrow__body">
        <Link className="ulrow__title" to={`/chapters/${url}`} style={{ fontWeight: '600' }}>
          {comicTitle}
        </Link>
        <div className="ulrow__meta">
          {metaItems.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="ulrow__dot"></span>}
              {item}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="ulrow__actions">

        {/* 1. Trạng thái duyệt đóng góp ở vị trí ulrow__folder */}
        <span className={`ulrow__folder status-${contributor.status}`}>
          {contributor.status === 'pending' ? 'Pending' : contributor.status === 'accept' ? 'Accepted' : 'Rejected'}
        </span>

        {/* Số tin chưa đọc */}
        {contributor.unread > 0 && (
          <span className="unread-pill">{contributor.unread} unread</span>
        )}
      </div>
    </li>
  );
}