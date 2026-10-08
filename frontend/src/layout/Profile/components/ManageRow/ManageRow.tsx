import type { ReactNode } from 'react';
import Cover from '../../../../components/Cover/Cover';
import Dropdown, { DropdownItem } from '../../../../components/Dropdown/Dropdown';
import { getImage } from '../../../../helpers/getImage';
import style from './ManageRow.module.css';

interface ManageRowProps {
  title: ReactNode;
  meta?: ReactNode[];
  cover?: string | null;
  actions?: ReactNode;
}

/** Compact list row used by the moderation and admin tools. */
export default function ManageRow({ title, meta = [], cover, actions }: ManageRowProps) {
  return (
    <li className={style.row}>
      {cover !== undefined ? <Cover src={getImage(cover)} size="sm" /> : null}
      <div className={style.body}>
        <div className={style.title}>{title}</div>
        {meta.length ? (
          <div className={style.meta}>
            {meta.filter(Boolean).map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        ) : null}
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
