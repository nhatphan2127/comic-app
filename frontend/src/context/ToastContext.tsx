import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import cx from '../helpers/cx';
import styles from './Toast.module.css';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  /** Shows the error's own message when it has one, otherwise `fallback`. */
  error: (err: unknown, fallback?: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const DURATION_MS: Record<Tone, number> = { success: 3000, info: 4000, error: 6000 };
const MAX_VISIBLE = 4;
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      info: (message) => push('info', message),
      error: (err, fallback = 'Something went wrong. Please try again.') =>
        push(
          'error',
          typeof err === 'string'
            ? err
            : // fetch() rejects with a TypeError when the server can't be reached at all.
              err instanceof TypeError
              ? "Can't reach the server. Check your connection and try again."
              : err instanceof Error && err.message
                ? err.message
                : fallback,
        ),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className={styles.stack} role="region" aria-label="Notifications" aria-live="polite">
          {toasts.map(({ id, tone, message }) => {
            const Icon = ICONS[tone];
            return (
              <div key={id} className={cx(styles.toast, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
                <Icon size={18} className={styles.icon} />
                <span className={styles.message}>{message}</span>
                <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(id)}>
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
