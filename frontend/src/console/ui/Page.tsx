import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import cx from '../../helpers/cx';
import style from './ui.module.css';

interface PageProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right of the heading (e.g. "+ Upload chapter"). */
  actions?: ReactNode;
  /** Shows a "Back" link above the title. */
  back?: { to: string; label?: string };
  children: ReactNode;
}

/** Frame of every console screen: heading row, then the body. */
export default function Page({ title, description, actions, back, children }: PageProps) {
  return (
    <section className={style.page}>
      <header className={style.pageHead}>
        <div className={style.pageHeadText}>
          {back ? (
            <Link to={back.to} className={style.back}>
              <ArrowLeft size={14} />
              {back.label ?? 'Back'}
            </Link>
          ) : null}
          <h1 className={style.pageTitle}>{title}</h1>
          {description ? <p className={style.pageDescription}>{description}</p> : null}
        </div>
        {actions ? <div className={style.pageActions}>{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

interface PageStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingText?: string;
  emptyTitle?: string;
  emptyText?: ReactNode;
  children: ReactNode;
}

/** Loading / error / empty placeholders, otherwise the children. */
export function PageState({ loading, error, empty, loadingText = 'Loading…', emptyTitle = 'Nothing here yet', emptyText, children }: PageStateProps) {
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

/** Bordered surface with an optional heading, for grouping content on a screen. */
export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx(style.card, className)}>
      {title || actions ? (
        <div className={style.cardHead}>
          {title ? <h2 className={style.cardTitle}>{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Success / error banner shown above a form or list. */
export function Notice({ tone, children }: { tone: 'ok' | 'err' | 'info'; children: ReactNode }) {
  return (
    <div className={cx(style.notice, style[`notice_${tone}`])} role={tone === 'err' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
