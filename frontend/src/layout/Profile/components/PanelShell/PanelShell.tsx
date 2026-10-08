import type { ReactNode } from 'react';
import style from './PanelShell.module.css';

interface PanelShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Common frame for every profile tab: heading row + body. */
export default function PanelShell({ title, subtitle, actions, children }: PanelShellProps) {
  return (
    <section className={style.panel}>
      <header className={style.head}>
        <div className={style.headText}>
          <h2 className={style.title}>{title}</h2>
          {subtitle ? <p className={style.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={style.actions}>{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

interface PanelStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingText?: string;
  emptyTitle?: string;
  emptyText?: ReactNode;
  children: ReactNode;
}

/** Renders loading / error / empty placeholders, otherwise the children. */
export function PanelState({
  loading,
  error,
  empty,
  loadingText = 'Loading…',
  emptyTitle = 'Nothing here yet',
  emptyText,
  children,
}: PanelStateProps) {
  if (loading) return <div className="empty-state">{loadingText}</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (empty) {
    return (
      <div className="empty-state">
        <strong>{emptyTitle}</strong>
        {emptyText}
      </div>
    );
  }
  return <>{children}</>;
}
