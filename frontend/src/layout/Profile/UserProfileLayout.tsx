import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UserProfile } from '../../types/types';
import ProfileHeader from './components/ProfileHeader/ProfileHeader';
import ProfileSidebar from './components/ProfileSidebar/ProfileSidebar';
import EditProfilePanel from './components/EditProfilePanel/EditProfilePanel';
import FollowingTitlesPanel from './components/FollowingTitlesPanel/FollowingTitlesPanel';
import ReadHistoryPanel from './components/HistoryReadingPanel/HistoryReadingPanel';
import NotificationsPanel from './components/NotificationsPanel/NotificationsPanel';
import CommentsPanel from './components/CommentsPanel/CommentsPanel';
import UploadedChaptersPanel from './components/UploadedChaptersPanel/UploadedChaptersPanel';
import ComicSuggestionPanel from './components/ComicSuggestionPanel/ComicSuggestionPanel';
import ModerationPanel from './components/ModerationPanel/ModerationPanel';
import ReportsPanel from './components/ReportsPanel/ReportsPanel';
import AdminDashboardPanel from './components/AdminDashboardPanel/AdminDashboardPanel';
import { useAuth } from '../../context/AuthContext';
import { canContribute, canModerate, isAdmin } from '../../helpers/roles';
import style from './UserProfileLayout.module.css';

const PANELS: Record<string, ComponentType> = {
  'edit-profile': EditProfilePanel,
  'following-titles': FollowingTitlesPanel,
  'read-history': ReadHistoryPanel,
  notifications: NotificationsPanel,
  comments: CommentsPanel,
  'chapter-uploads': UploadedChaptersPanel,
  'comic-suggestions': ComicSuggestionPanel,
  'moderation-queue': ModerationPanel,
  reports: ReportsPanel,
  'admin-dashboard': AdminDashboardPanel,
};

// Tabs that need more than a reader account; the sidebar hides them too.
const TAB_ACCESS: Record<string, (role?: string | null) => boolean> = {
  'chapter-uploads': canContribute,
  'comic-suggestions': canContribute,
  'moderation-queue': canModerate,
  reports: canModerate,
  'admin-dashboard': isAdmin,
};

const DEFAULT_TAB = 'edit-profile';

type UserProfilePageProps = {
  user?: UserProfile | null;
  loading?: boolean;
  error?: string | null;
  onUserUpdated?: (user: UserProfile) => void;
};

export default function UserProfilePage({ user, loading = false, error = null, onUserUpdated }: UserProfilePageProps) {
  // The active tab lives in the URL (?tab=...) so it survives reloads and can be linked to.
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: authUser } = useAuth();
  const requested = searchParams.get('tab') || DEFAULT_TAB;
  const allowed = TAB_ACCESS[requested]?.(authUser?.role) ?? true;
  const activeTab = allowed ? requested : DEFAULT_TAB;
  const Panel = PANELS[activeTab];

  return (
    <div className={style.page}>
      <ProfileHeader user={user} loading={loading} onProfileUpdated={onUserUpdated} />

      {error ? <div className="empty-state">{error}</div> : null}

      <div className={style.shell}>
        <ProfileSidebar activeTab={activeTab} setActiveTab={(tab) => setSearchParams({ tab })} />
        <main className={style.content}>
          {Panel ? <Panel /> : <div className="empty-state">This section does not exist.</div>}
        </main>
      </div>
    </div>
  );
}
