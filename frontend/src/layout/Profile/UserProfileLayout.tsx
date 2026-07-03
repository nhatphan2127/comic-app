import { useSearchParams } from 'react-router-dom';
import ProfileHeader from './ProfileHeader';
import ProfileSidebar from './ProfileSidebar';
import type { UserProfile } from '../../types/data';
import EditProfilePanel from './panels/EditProfilePanel';
import FollowingTitlesPanel from './panels/FollowingTitlesPanel';
import ReadHistoryPanel from './panels/HistoryReadingPanel';
import NotificationsPanel from './panels/NotificationsPanel';
import CommentsPanel from './panels/CommentsPanel';
import SettingsPanel from './panels/SettingsPanel';
import '../../assets/styles/UserProfile.css';
import '../../assets/styles/ComicForm.css';
import UploadedChaptersPanel from './panels/UploadedChaptersPanel';
import ComicSuggestionPanel from './panels/ComicSuggestionPanel';

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
      case 'settings':
        return <SettingsPanel />;
      case 'chapter-uploads':
        return <UploadedChaptersPanel/>
      case 'comic-suggestions':
        return <ComicSuggestionPanel/>
      default:
        return (
          <div className="empty-state-container">
            <p>Tính năng đang được cập nhật...</p>
          </div>
        );
    }
  };

  return (
    <div className='user-main'>
      <div className="user-wrap">
      <ProfileHeader user={user} loading={loading} />
      {error ? (
        <div className="empty-state-container">
          <p>{error}</p>
        </div>
      ) : null}
      <div className="user-shell">
        {/* Truyền giá trị activeTab và hàm thay đổi đồng bộ lên URL cho Sidebar */}
        <ProfileSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="user-content">
          {renderContentPanel()}
        </main>
      </div>
    </div>
    </div>
  );
}