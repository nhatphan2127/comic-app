import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../helpers/roles';
import Avatar from '../components/Avatar/Avatar';
import Logo from '../components/Logo/Logo';
import NotificationMenu from '../layout/HeaderLayout/NotificationMenu';
import cx from '../helpers/cx';
import { ConsoleContext } from './ConsoleContext';
import type { ConsoleConfig, ConsoleModule } from './types';
import style from './ConsoleLayout.module.css';

const ROLE_LABEL: Record<string, string> = { user: 'Reader', contributor: 'Contributor', moderator: 'Moderator', admin: 'Admin' };

interface Props {
  config: ConsoleConfig;
  modules: ConsoleModule[];
}

/** Shell shared by every console: side navigation, top bar, and the active module below. */
export default function ConsoleLayout({ config, modules }: Props) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  const to = useCallback((path = '') => (path ? `${config.basePath}/${path}` : config.basePath), [config.basePath]);

  const refreshBadges = useCallback(() => {
    modules.forEach((m) => {
      m.badge
        ?.()
        .then((n) => setBadges((prev) => (prev[m.path] === n ? prev : { ...prev, [m.path]: n })))
        .catch(() => undefined);
    });
  }, [modules]);

  // Badges follow navigation (cheap counts), and the mobile drawer closes on every page change.
  useEffect(() => {
    refreshBadges();
    setNavOpen(false);
  }, [location.pathname, refreshBadges]);

  const groups = useMemo(() => {
    const map = new Map<string, ConsoleModule[]>();
    modules.forEach((m) => map.set(m.group ?? '', [...(map.get(m.group ?? '') ?? []), m]));
    return [...map.entries()];
  }, [modules]);

  // The module whose path is the longest prefix of the URL (home matches only itself).
  const current = useMemo(() => {
    const rest = location.pathname.slice(config.basePath.length).replace(/^\/+/, '');
    return modules.find((m) => m.path && (rest === m.path || rest.startsWith(`${m.path}/`))) ?? modules.find((m) => !m.path);
  }, [location.pathname, config.basePath, modules]);

  const otherConsole =
    config.id === 'studio'
      ? isAdmin(user?.role) && { to: '/admin', label: 'Admin console' }
      : { to: '/studio', label: 'Studio' };

  const displayName = user?.displayName || user?.userName || 'User';
  const contextValue = useMemo(() => ({ config, to, refreshBadges }), [config, to, refreshBadges]);

  return (
    <ConsoleContext.Provider value={contextValue}>
      <div className={style.shell} data-console={config.id}>
        <aside className={cx(style.side, navOpen && style.sideOpen)} aria-label={`${config.title} navigation`}>
          <div className={style.brand}>
            <Logo size="sm" />
            <span className={style.brandTag}>{config.title}</span>
            <button type="button" className={cx(style.iconBtn, style.closeNav)} aria-label="Close menu" onClick={() => setNavOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <nav className={style.nav}>
            {groups.map(([group, items]) => (
              <div key={group || 'main'} className={style.group}>
                {group ? <span className={style.groupLabel}>{group}</span> : null}
                {items.map(({ path, label, icon: Icon }) => (
                  <NavLink key={path || 'home'} to={to(path)} end={!path} className={({ isActive }) => cx(style.item, isActive && style.itemOn)}>
                    <Icon size={17} />
                    <span className={style.itemLabel}>{label}</span>
                    {badges[path] ? <span className={cx(style.count, 'mono')}>{badges[path] > 99 ? '99+' : badges[path]}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className={style.sideFoot}>
            <Link to="/" className={style.footLink}>
              <BookOpen size={16} />
              Back to reading
            </Link>
            {otherConsole ? (
              <Link to={otherConsole.to} className={style.footLink}>
                <ArrowLeftRight size={16} />
                {otherConsole.label}
              </Link>
            ) : null}
            <div className={style.me}>
              <Link to="/profile" className={style.meLink}>
                <Avatar name={displayName} size={32} />
                <span className={style.meText}>
                  <span className={style.meName}>{displayName}</span>
                  <span className={style.meRole}>{ROLE_LABEL[user?.role ?? 'user'] ?? user?.role}</span>
                </span>
              </Link>
              <button type="button" className={style.iconBtn} aria-label="Sign out" title="Sign out" onClick={() => void logout()}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {navOpen ? <div className={style.backdrop} onClick={() => setNavOpen(false)} aria-hidden="true" /> : null}

        <div className={style.main}>
          <header className={style.topbar}>
            <button type="button" className={cx(style.iconBtn, style.openNav)} aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <Menu size={18} />
            </button>
            <nav className={style.crumbs} aria-label="Breadcrumb">
              <Link to={to()}>{config.title}</Link>
              {current?.path ? (
                <>
                  <span aria-hidden="true">/</span>
                  <span className={style.crumbHere}>{current.label}</span>
                </>
              ) : null}
            </nav>
            <div className={style.topActions}>
              <NotificationMenu />
            </div>
          </header>

          <main className={style.content}>
            <Suspense fallback={<div className="empty-state">Loading…</div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </ConsoleContext.Provider>
  );
}
