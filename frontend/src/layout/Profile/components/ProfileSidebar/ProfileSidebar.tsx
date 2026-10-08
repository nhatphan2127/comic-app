import { useMemo, useState } from 'react';
import {
  Bell,
  BookUp,
  Bookmark,
  ChevronDown,
  Clock3,
  Flag,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Upload,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import cx from '../../../../helpers/cx';
import { canContribute, canModerate, isAdmin as isAdminRole } from '../../../../helpers/roles';
import style from './ProfileSidebar.module.css';

interface Props {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: 'Account' | 'Library' | 'Contribute' | 'Staff';
}

export default function ProfileSidebar({ activeTab, setActiveTab }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const isContributor = canContribute(user?.role);
  const isModerator = canModerate(user?.role);
  const isAdmin = isAdminRole(user?.role);

  const items = useMemo<SidebarItem[]>(
    () => [
      { id: 'edit-profile', label: 'Edit profile', icon: User, group: 'Account' },
      { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Account' },
      { id: 'comments', label: 'Comments', icon: MessageSquare, group: 'Account' },
      { id: 'following-titles', label: 'Following', icon: Bookmark, group: 'Library' },
      { id: 'read-history', label: 'Reading history', icon: Clock3, group: 'Library' },
      // Uploading needs the contributor role (the API answers 403 otherwise).
      ...(isContributor
        ? [
            { id: 'chapter-uploads', label: 'Chapter uploads', icon: Upload, group: 'Contribute' as const },
            { id: 'comic-suggestions', label: 'Suggest a comic', icon: BookUp, group: 'Contribute' as const },
          ]
        : []),
      ...(isModerator
        ? [
            { id: 'moderation-queue', label: 'Moderation queue', icon: ShieldCheck, group: 'Staff' as const },
            { id: 'reports', label: 'Reports', icon: Flag, group: 'Staff' as const },
          ]
        : []),
      ...(isAdmin ? [{ id: 'admin-dashboard', label: 'Admin dashboard', icon: LayoutDashboard, group: 'Staff' as const }] : []),
    ],
    [isAdmin, isModerator, isContributor],
  );

  const groups = useMemo(() => {
    const map = new Map<string, SidebarItem[]>();
    items.forEach((item) => map.set(item.group, [...(map.get(item.group) ?? []), item]));
    return [...map.entries()];
  }, [items]);

  const active = items.find((item) => item.id === activeTab) ?? items[0];
  const ActiveIcon = active.icon;

  return (
    <aside className={cx(style.sidebar, isOpen && style.open)}>
      <button type="button" className={style.trigger} aria-expanded={isOpen} onClick={() => setIsOpen((v) => !v)}>
        <ActiveIcon size={16} />
        <span>{active.label}</span>
        <ChevronDown size={16} className={style.caret} />
      </button>

      <nav className={style.nav} aria-label="Profile sections">
        {groups.map(([group, groupItems]) => (
          <div key={group} className={style.group}>
            <span className={style.groupLabel}>{group}</span>
            {groupItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={cx(style.item, activeTab === id && style.itemOn)}
                aria-current={activeTab === id ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(id);
                  setIsOpen(false);
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
