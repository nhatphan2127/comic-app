import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo/Logo';
import SettingsLayout from '../FilterSettingsLayout/FilterSettingsLayout';
import AuthModalLayout from '../AuthModalLayout/AuthModalLayout';
import HeaderSearch from './HeaderSearch';
import NotificationMenu from './NotificationMenu';
import UserMenu from './UserMenu';
import styles from './HeaderLayout.module.css';

export default function HeaderLayout() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Logo />

          <HeaderSearch />

          <nav className={styles.actions} aria-label="Account">
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Settings"
              title="Settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={18} />
            </button>

            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Browse"
                  title="Browse"
                  onClick={() => navigate('/browse')}
                >
                  <LayoutGrid size={18} />
                </button>
                <NotificationMenu />
                <UserMenu />
              </>
            ) : (
              <button type="button" className={styles.loginBtn} onClick={() => setIsAuthOpen(true)}>
                Log in
              </button>
            )}
          </nav>
        </div>
      </header>

      <SettingsLayout isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AuthModalLayout isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
