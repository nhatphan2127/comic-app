import { Link } from 'react-router-dom';
import { Download, Heart } from 'lucide-react';
import useInstallPrompt from '../../hooks/useInstallPrompt';
import cx from '../../helpers/cx';
import Logo from '../../components/Logo/Logo';
import { BRAND } from '../../config/brand';
import styles from './FooterLayout.module.css';

// Only links with a real destination. `/profile` tabs need an account; ProtectedRoute handles that.
const LINK_GROUPS = [
  {
    title: 'Explore',
    links: [
      { label: 'Trending manga', to: '/browse?type=manga&sort=-view' },
      { label: 'Trending manhwa', to: '/browse?type=manhwa&sort=-view' },
      { label: 'Top rated', to: '/browse?sort=-rating' },
      { label: 'Browse all', to: '/browse' },
    ],
  },
  {
    title: 'Library',
    links: [
      { label: 'Following', to: '/profile?tab=following-titles' },
      { label: 'Reading history', to: '/profile?tab=read-history' },
      { label: 'Notifications', to: '/profile?tab=notifications' },
    ],
  },
];

export default function FooterLayout() {
  const install = useInstallPrompt();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo size="sm" />
          <p className={styles.tagline}>{BRAND.tagline}</p>
          {install ? (
            <button type="button" className={cx('btn btn--ghost btn--sm', styles.install)} onClick={() => void install()}>
              <Download size={14} />
              Install app
            </button>
          ) : null}
        </div>

        {LINK_GROUPS.map((group) => (
          <nav key={group.title} className={styles.group} aria-label={group.title}>
            <h4 className={styles.groupTitle}>{group.title}</h4>
            <ul className={styles.links}>
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span>
            © {BRAND.year} {BRAND.name}
          </span>
          <span className={styles.made}>
            Made with <Heart size={13} className={styles.heart} /> for comic readers
          </span>
        </div>
      </div>
    </footer>
  );
}
