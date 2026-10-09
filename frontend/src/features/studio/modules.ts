// The Studio: contributors upload and suggest, moderators also review and handle reports.
// To add a feature: create a folder next to this file and add one entry below.
import { lazy } from 'react';
import { BookCopy, BookOpen, Flag, FolderDown, KeyRound, LayoutDashboard, ShieldCheck, Upload } from 'lucide-react';
import { moderationApi } from '../../services/api';
import { canContribute, canModerate } from '../../helpers/roles';
import type { ConsoleConfig } from '../../console/types';

export const studioConsole: ConsoleConfig = {
  id: 'studio',
  title: 'Studio',
  basePath: '/studio',
  access: canContribute,
  modules: [
    { path: '', label: 'Overview', icon: LayoutDashboard, element: lazy(() => import('./overview/StudioOverview')) },
    { path: 'uploads', label: 'Chapter uploads', icon: Upload, group: 'Contribute', element: lazy(() => import('./uploads/UploadsModule')) },
    { path: 'comics', label: 'My comics', icon: BookCopy, group: 'Contribute', element: lazy(() => import('./comics/ComicsModule')) },
    {
      path: 'queue',
      label: 'Review queue',
      icon: ShieldCheck,
      group: 'Moderation',
      access: canModerate,
      element: lazy(() => import('./queue/QueueModule')),
      badge: moderationApi.countPending,
    },
    {
      path: 'reports',
      label: 'Reports',
      icon: Flag,
      group: 'Moderation',
      access: canModerate,
      element: lazy(() => import('./reports/ReportsModule')),
      badge: () => moderationApi.countReports('open'),
    },
    { path: 'api-keys', label: 'API keys', icon: KeyRound, group: 'Developers', element: lazy(() => import('./api-keys/ApiKeysModule')) },
    { path: 'comic-folders', label: 'Comic folders', icon: FolderDown, group: 'Developers', element: lazy(() => import('./comic-folders/ComicFoldersModule')) },
    { path: 'api-guide', label: 'API guide', icon: BookOpen, group: 'Developers', element: lazy(() => import('./api-guide/ApiGuideModule')) },
  ],
};
