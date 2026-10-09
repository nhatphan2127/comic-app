import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import cx from '../../helpers/cx';
import style from './ui.module.css';

type Tone = 'accent' | 'ok' | 'warn' | 'err' | 'info';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  /** Makes the whole card a link to the matching screen. */
  to?: string;
}

export function StatCard({ label, value, icon: Icon, tone = 'accent', hint, to }: StatCardProps) {
  const body = (
    <>
      <span className={cx(style.statIcon, style[`tone_${tone}`])}>
        <Icon size={18} />
      </span>
      <span className={style.statText}>
        <span className={style.statLabel}>{label}</span>
        <span className={cx(style.statValue, 'mono')}>{value}</span>
        {hint ? <span className={style.statHint}>{hint}</span> : null}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={cx(style.stat, style.statLink)}>
      {body}
    </Link>
  ) : (
    <div className={style.stat}>{body}</div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={style.stats}>{children}</div>;
}
