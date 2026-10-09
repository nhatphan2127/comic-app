import type { ReactNode } from 'react';
import Cover from '../../components/Cover/Cover';
import Dropdown, { DropdownItem } from '../../components/Dropdown/Dropdown';
import { getImage } from '../../helpers/getImage';
import style from './ManageRow.module.css';

interface ManageRowProps {
  title: ReactNode;
  meta?: ReactNode[];
  /** A comic cover on the left (pass null for "no image"). */
  cover?: string | null;
  /** Anything else on the left, e.g. an avatar. */
  leading?: ReactNode;
  /** Extra content under the meta line (a quote, a long text…). */
  children?: ReactNode;
  actions?: ReactNode;
}

/** Compact list row used across the consoles. */
export default function ManageRow({ title, meta = [], cover, leading, children, actions }: ManageRowProps) {
  return (
    <li className={style.row}>
      {cover !== undefined ? <Cover src={getImage(cover)} size="sm" /> : leading}
      <div className={style.body}>
        <div className={style.title}>{title}</div>
        {meta.length ? (
          <div className={style.meta}>
            {meta.filter(Boolean).map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        ) : null}
        {children}
      </div>
      {actions ? <div className={style.actions}>{actions}</div> : null}
    </li>
  );
}

export function ManageList({ children }: { children: ReactNode }) {
  return <ul className={style.list}>{children}</ul>;
}

interface StateSelectProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Small dropdown for switching an item's state (visibility, ban, …). */
export function StateSelect<T extends string>({ value, options, onChange }: StateSelectProps<T>) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <Dropdown value={current} align="right" className={style.state}>
      {(close) =>
        options.map((opt) => (
          <DropdownItem
            key={opt.value}
            kind="radio"
            selected={opt.value === value}
            onClick={() => {
              close();
              if (opt.value !== value) onChange(opt.value);
            }}
          >
            {opt.label}
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
}
