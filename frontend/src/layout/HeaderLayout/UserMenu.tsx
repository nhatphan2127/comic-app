import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Bookmark, History, LayoutDashboard, LogOut, MessageSquare, Shield, Sparkles, User, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useClickOutside from '../../hooks/useClickOutside';
import Avatar from '../../components/Avatar/Avatar';
import cx from '../../helpers/cx';
import { canContribute, isAdmin } from '../../helpers/roles';
import styles from './HeaderLayout.module.css';

const MENU_ITEMS: { tab: string; label: string; icon: LucideIcon }[] = [
  { tab: 'edit-profile', label: 'My profile', icon: User },
  { tab: 'following-titles', label: 'Following', icon: Bookmark },
  { tab: 'read-history', label: 'Reading history', icon: History },
  { tab: 'notifications', label: 'Notifications', icon: Bell },
  { tab: 'comments', label: 'My comments', icon: MessageSquare },
];

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(rootRef, close, isOpen);

  const displayName = user?.displayName || user?.userName || 'User';

  const goTo = (tab: string) => {
    setIsOpen(false);
    navigate(`/profile?tab=${tab}`);
  };

  // Workspaces by role: readers get the way in, everyone else gets their consoles.
  const workspaces: { to: string; label: string; icon: LucideIcon }[] = canContribute(user?.role)
    ? [
        { to: '/studio', label: 'Studio', icon: LayoutDashboard },
        ...(isAdmin(user?.role) ? [{ to: '/admin', label: 'Admin console', icon: Shield }] : []),
      ]
    : [{ to: '/profile?tab=become-contributor', label: 'Become a contributor', icon: Sparkles }];

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={cx(styles.avatarBtn, isOpen && styles.avatarBtnActive)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Avatar name={displayName} size={30} />
      </button>

      {isOpen ? (
        <div className={cx(styles.pop, styles.userPop)} role="menu">
          <button type="button" className={styles.userCard} onClick={() => goTo('edit-profile')}>
            <Avatar name={displayName} size={40} />
            <span className={styles.userId}>
              <span className={styles.userName}>{displayName}</span>
              {user?.userName ? <span className={cx(styles.userHandle, 'mono')}>@{user.userName}</span> : null}
            </span>
          </button>

          <ul className={styles.menuList}>
            {MENU_ITEMS.map(({ tab, label, icon: Icon }) => (
              <li key={tab}>
                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => goTo(tab)}>
                  <Icon size={16} />
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <ul className={styles.menuList}>
            {workspaces.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setIsOpen(false);
                    navigate(to);
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            role="menuitem"
            className={cx(styles.menuItem, styles.menuItemDanger)}
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
