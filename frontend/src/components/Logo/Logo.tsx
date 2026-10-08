import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import cx from '../../helpers/cx';
import styles from './Logo.module.css';

interface LogoProps {
  size?: 'sm' | 'md';
  asLink?: boolean;
  className?: string;
}

/** Brand mark: an open book whose pages form a brush stroke, plus the wordmark. */
export default function Logo({ size = 'md', asLink = true, className }: LogoProps) {
  const content = (
    <>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" className={styles.markBg} />
        <path
          className={styles.markInk}
          d="M8 10.5c2.6-.9 5.3-.6 8 1.2v11.6c-2.7-1.7-5.4-2-8-1.1V10.5Zm16 0c-2.6-.9-5.3-.6-8 1.2v11.6c2.7-1.7 5.4-2 8-1.1V10.5Z"
        />
      </svg>
      <span className={styles.word}>{BRAND.name}</span>
    </>
  );

  const classes = cx(styles.logo, styles[size], className);

  return asLink ? (
    <Link to="/" className={classes} aria-label={`${BRAND.name} home`}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
