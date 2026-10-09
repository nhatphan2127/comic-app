// The Admin console: people, content and platform settings. Admins only.
// To add a feature: create a folder next to this file and add one entry below.
import { lazy } from 'react';
import { BookCopy, Files, LayoutDashboard, MessageSquare, Settings, UserPlus, Users } from 'lucide-react';
import { adminApi } from '../../services/api';
import { isAdmin } from '../../helpers/roles';
import type { ConsoleConfig } from '../../console/types';

const content = () => import('./content/ContentModule');

export const adminConsole: ConsoleConfig = {
  id: 'admin',
  title: 'Admin',
  basePath: '/admin',
  access: isAdmin,
  modules: [
    { path: '', label: 'Overview', icon: LayoutDashboard, element: lazy(() => import('./overview/AdminOverview')) },
    { path: 'users', label: 'Users', icon: Users, group: 'People', element: lazy(() => import('./users/UsersModule')) },
    {
      path: 'role-requests',
      label: 'Contributor requests',
      icon: UserPlus,
      group: 'People',
      element: lazy(() => import('./role-requests/RoleRequestsModule')),
      badge: async () => (await adminApi.listRoleRequests({ status: 'pending', pageSize: 1 })).meta.totalItems,
    },
    { path: 'comics', label: 'Comics', icon: BookCopy, group: 'Content', element: lazy(() => content().then((m) => ({ default: m.ComicsModule }))) },
    { path: 'chapters', label: 'Chapters', icon: Files, group: 'Content', element: lazy(() => content().then((m) => ({ default: m.ChaptersModule }))) },
    { path: 'comments', label: 'Comments', icon: MessageSquare, group: 'Content', element: lazy(() => import('./comments/CommentsModule')) },
    { path: 'settings', label: 'Settings', icon: Settings, group: 'Platform', element: lazy(() => import('./settings/SettingsModule')) },
  ],
};
