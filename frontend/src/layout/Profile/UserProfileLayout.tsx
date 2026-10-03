import { useSearchParams } from 'react-router-dom';
import ProfileHeader from './components/ProfileHeader/ProfileHeader';
import ProfileSidebar from './components/ProfileSidebar/ProfileSidebar';
import type { UserProfile } from '../../types/types';
import EditProfilePanel from './components/EditProfilePanel/EditProfilePanel';
import FollowingTitlesPanel from './components/FollowingTitlesPanel/FollowingTitlesPanel';
import ReadHistoryPanel from './components/HistoryReadingPanel/HistoryReadingPanel';
import NotificationsPanel from './components/NotificationsPanel/NotificationsPanel';
import CommentsPanel from './components/CommentsPanel/CommentsPanel';
import UploadedChaptersPanel from './components/UploadedChaptersPanel/UploadedChaptersPanel';
import ComicSuggestionPanel from './components/ComicSuggestionPanel/ComicSuggestionPanel';
import ModerationPanel from './components/ModerationPanel/ModerationPanel';
import AdminDashboardPanel from './components/AdminDashboardPanel/AdminDashboardPanel';
import style from './UserProfileLayout.module.css';

type UserProfilePageProps = {
  user?: UserProfile | null;
  loading?: boolean;
  error?: string | null;
};

export default function UserProfilePage({ user, loading = false, error = null }: UserProfilePageProps) {
  // 1. Sử dụng useSearchParams để lấy/thiết lập tham số từ URL
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Lấy giá trị của 'tab', mặc định là 'edit-profile' nếu không có
  const activeTab = searchParams.get('tab') || 'edit-profile';

  // 2. Hàm chuyển đổi tab đồng bộ lên URL
  const setActiveTab = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const renderContentPanel = () => {
    switch (activeTab) {
      case 'edit-profile':
        return <EditProfilePanel />;
      case 'following-titles':
        return <FollowingTitlesPanel />;
      case 'read-history':
        return <ReadHistoryPanel />;
      case 'notifications':
        return <NotificationsPanel />;
      case 'comments':
        return <CommentsPanel />;
      case 'chapter-uploads':
        return <UploadedChaptersPanel />;
      case 'comic-suggestions':
        return <ComicSuggestionPanel />;
      case 'moderation-queue':
        return <ModerationPanel />;
      case 'admin-dashboard':
        return <AdminDashboardPanel />;
      default:
        return (
          <div className={style['empty-state-container']}>
            <p>Tính năng đang được cập nhật...</p>
          </div>
        );
    }
  };

  return (
    <div className={style['user-main']}>
      <div className={style['user-wrap']}>
        <ProfileHeader user={user} loading={loading} />
        {error ? (
          <div className={style['empty-state-container']}>
            <p>{error}</p>
          </div>
        ) : null}
        <div className={style['user-shell']}>
          {/* Truyền giá trị activeTab và hàm thay đổi đồng bộ lên URL cho Sidebar */}
          <ProfileSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className={style['user-content']}>
            {renderContentPanel()}
          </main>
        </div>
      </div>
    </div>
  );
}