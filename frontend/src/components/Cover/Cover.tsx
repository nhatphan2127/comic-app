import cx from '../../helpers/cx';
import styles from './Cover.module.css';

interface CoverProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'fill';
  blurred?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Comic cover with a fixed 2:3 ratio and a shimmer placeholder while loading. */
export default function Cover({ src, alt = '', size = 'fill', blurred, className, children }: CoverProps) {
  return (
    <div className={cx(styles.cover, styles[size], blurred && styles.blurred, className)}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : null}
      {children}
    </div>
  );
}
