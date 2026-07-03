import type { UserProfile } from '../../types/data';
import { API_UPLOADS } from '../../services/api';

type ProfileHeaderProps = {
  user?: UserProfile | null;
  loading?: boolean;
};

// Hàm lấy chữ cái viết tắt của tên
function getInitials(displayName?: string | null, username?: string | null) {
  const source = displayName || username || 'User';
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Hàm sinh mã màu ngẫu nhiên dựa trên chuỗi ký tự (cho Avatar mặc định)
function getAvatarBgColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Giới hạn giá trị màu để tạo tông màu tối/ấm ấm dễ chịu giống mẫu
  const r = Math.abs((hash & 0xff) % 120 + 60);
  const g = Math.abs(((hash >> 8) & 0xff) % 120 + 60);
  const b = Math.abs(((hash >> 16) & 0xff) % 120 + 60);
  return `rgb(${r}, ${g}, ${b})`;
}

function resolveAvatarUrl(avatar?: string | null) {
  if (!avatar) {
    return null;
  }

  if (/^https?:\/\//i.test(avatar) || avatar.startsWith('data:')) {
    return avatar;
  }

  return `${API_UPLOADS}${avatar.replace(/^\/+/, '')}`;
}

export default function ProfileHeader({ user, loading = false }: ProfileHeaderProps) {
  const displayName = user?.displayName || user?.username || 'User';
  const avatarUrl = resolveAvatarUrl(user?.avatar);
  const initials = getInitials(user?.displayName, user?.username);
  const avatarBgColor = getAvatarBgColor(displayName);

  // Thêm đầy đủ 6 chỉ số thống kê tương ứng với mẫu giao diện
  const stats = [
    { label: 'Comics', value: (user as any)?.stats?.titles ?? (user as any)?.titlesCount ?? 0 },
    { label: 'Groups', value: (user as any)?.stats?.groups ?? (user as any)?.groupsCount ?? 0 },
    { label: 'Chapters', value: (user as any)?.stats?.chapters ?? (user as any)?.chaptersCount ?? 0 },
    { label: 'Comments', value: (user as any)?.stats?.comments ?? (user as any)?.commentsCount ?? 0 },
    { label: 'Likes', value: (user as any)?.stats?.likes ?? (user as any)?.likesCount ?? 0 },
  ];

  return (
    <header className="uprofile">
      <div className="uprofile__body">
        {/* Phần ảnh đại diện */}
        {loading ? (
          <span 
            className="uavatar uprofile__avatar" 
            aria-hidden="true" 
            style={{ width: '84px', height: '84px', fontSize: '35px', background: '#e2e8f0' }}
          >
            ...
          </span>
        ) : avatarUrl ? (
          <img 
            className="uavatar uprofile__avatar" 
            src={avatarUrl} 
            alt={displayName} 
            style={{ width: '84px', height: '84px', objectFit: 'cover' }} 
          />
        ) : (
          <span 
            className="uavatar uprofile__avatar" 
            aria-hidden="true" 
            style={{ 
              width: '84px', 
              height: '84px', 
              fontSize: '35px', 
              backgroundColor: avatarBgColor 
            }}
          >
            {initials}
          </span>
        )}

        {/* Phần thông tin cá nhân */}
        <div className="uprofile__identity">
          <h1 className="uprofile__name">
            {loading ? 'Đang tải...' : displayName}
          </h1>
          {!loading && user?.username && (
            <div className="uprofile__username" style={{ fontSize: '14px', opacity: 0.7, marginTop: '4px' }}>
              @{user.username}
            </div>
          )}
        </div>

        {/* Phần chỉ số thống kê */}
        <div className="uprofile__stats">
          {stats.map((stat, idx) => (
            <div key={idx} className="uprofile__stat">
              <div className="uprofile__stat-num">{stat.value}</div>
              <div className="uprofile__stat-label mono">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}