import getAvatarBg from '../../helpers/getAvatarBg';
import cx from '../../helpers/cx';
import styles from './Avatar.module.css';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Round user avatar: shows the image when available, otherwise a colored initial. */
export default function Avatar({ name, src, size = 32, className }: AvatarProps) {
  const label = name?.trim() || 'U';

  return (
    <span
      className={cx(styles.avatar, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: src ? undefined : getAvatarBg(label),
      }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : label[0].toUpperCase()}
    </span>
  );
}
