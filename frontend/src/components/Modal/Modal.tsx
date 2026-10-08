import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import cx from '../../helpers/cx';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** "center" = dialog, "side" = drawer sliding from the right */
  variant?: 'center' | 'side';
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
}

/** Accessible modal rendered into document.body. Handles Escape, backdrop click and scroll lock. */
export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  footer,
  size = 'md',
  variant = 'center',
  ariaLabel,
  className,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={cx(styles.backdrop, variant === 'side' && styles.backdropSide)} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className={cx(styles.dialog, styles[size], variant === 'side' && styles.side, className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {title ? (
          <header className={styles.head}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </header>
        ) : null}

        <div className={cx(styles.body, bodyClassName)}>{children}</div>

        {footer ? <footer className={styles.foot}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
