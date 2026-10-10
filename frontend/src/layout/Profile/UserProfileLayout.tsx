import type { ComponentType } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { UserProfile } from '../../types/types';
import ProfileHeader from './components/ProfileHeader/ProfileHeader';
import ProfileSidebar from './components/ProfileSidebar/ProfileSidebar';
import EditProfilePanel from './components/EditProfilePanel/EditProfilePanel';
import FollowingTitlesPanel from './components/FollowingTitlesPanel/FollowingTitlesPanel';
import ReadHistoryPanel from './components/HistoryReadingPanel/HistoryReadingPanel';
import NotificationsPanel from './components/NotificationsPanel/NotificationsPanel';
import CommentsPanel from './components/CommentsPanel/CommentsPanel';
import BlockedUsersPanel from './components/BlockedUsersPanel/BlockedUsersPanel';
import BecomeContributorPanel from './components/BecomeContributorPanel/BecomeContributorPanel';
import style from './UserProfileLayout.module.css';

// The profile only holds the reader's own things; contributor, moderator and admin tools live in /studio and /admin.
const PANELS: Record<string, ComponentType> = {
  'edit-profile': EditProfilePanel,
  'following-titles': FollowingTitlesPanel,
  'read-history': ReadHistoryPanel,
  notifications: NotificationsPanel,
  comments: CommentsPanel,
  'blocked-users': BlockedUsersPanel,
  'become-contributor': BecomeContributorPanel,
};

// Tabs that used to live here, for old links and notifications already stored in the database.
const MOVED_TABS: Record<string, string> = {
  'chapter-uploads': '/studio/uploads',
  'comic-suggestions': '/studio/comics',
  'moderation-queue': '/studio/queue',
  reports: '/studio/reports',
  'admin-dashboard': '/admin',
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
  const requested = searchParams.get('tab') || DEFAULT_TAB;
  if (MOVED_TABS[requested]) return <Navigate to={MOVED_TABS[requested]} replace />;

  const activeTab = PANELS[requested] ? requested : DEFAULT_TAB;
  const Panel = PANELS[activeTab];

  return (
    <div className={style.page}>
      <ProfileHeader user={user} loading={loading} onProfileUpdated={onUserUpdated} />

      {error ? <div className="empty-state">{error}</div> : null}

      <div className={style.shell}>
        <ProfileSidebar activeTab={activeTab} setActiveTab={(tab) => setSearchParams({ tab })} />
        <main className={style.content}>
          <Panel />
        </main>
      </div>
    </div>
  );
}
