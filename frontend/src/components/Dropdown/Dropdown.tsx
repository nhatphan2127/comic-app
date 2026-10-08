import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside';
import cx from '../../helpers/cx';
import styles from './Dropdown.module.css';

interface DropdownProps {
  /** Small caption above the trigger (filter-field style). */
  label?: string;
  /** Text shown in the trigger button. Ignored if `trigger` is provided. */
  value?: ReactNode;
  /** Custom trigger content (e.g. an icon button). */
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: 'left' | 'right';
  width?: number | string;
  className?: string;
  ariaLabel?: string;
  children: (close: () => void) => ReactNode;
}

/** Button + popover with click-outside handling. Content receives a `close` callback. */
export default function Dropdown({
  label,
  value,
  trigger,
  triggerClassName,
  align = 'left',
  width,
  className,
  ariaLabel,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <button
        type="button"
        className={cx(trigger ? triggerClassName : styles.field, open && styles.fieldOpen)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger ?? (
          <>
            <span className={styles.value}>{value}</span>
            <ChevronDown size={14} className={styles.caret} />
          </>
        )}
      </button>
      {open ? (
        <div className={cx(styles.pop, align === 'right' && styles.popRight)} style={width ? { width } : undefined}>
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Menu items ---------- */

interface ItemProps {
  children: ReactNode;
  onClick: () => void;
  selected?: boolean;
  /** "radio" / "check" show an indicator column; "plain" does not. */
  kind?: 'radio' | 'check' | 'plain';
  danger?: boolean;
  icon?: ReactNode;
}

export function DropdownItem({ children, onClick, selected = false, kind = 'plain', danger, icon }: ItemProps) {
  return (
    <button
      type="button"
      role={kind === 'radio' ? 'menuitemradio' : kind === 'check' ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={kind === 'plain' ? undefined : selected}
      className={cx(styles.item, selected && styles.itemOn, danger && styles.itemDanger)}
      onClick={onClick}
    >
      {kind !== 'plain' ? (
        <span className={cx(styles.mark, kind === 'radio' && styles.markRadio, selected && styles.markOn)} aria-hidden="true">
          {selected ? <Check size={11} strokeWidth={3} /> : null}
        </span>
      ) : icon ? (
        <span className={styles.itemIcon}>{icon}</span>
      ) : null}
      <span className={styles.itemText}>{children}</span>
    </button>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className={styles.menuLabel}>{children}</div>;
}

export function DropdownDivider() {
  return <div className={styles.divider} />;
}

/* ---------- Ready-made multi-select ---------- */

interface MultiSelectProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  summary: string;
}

export function MultiSelect({ label, options, selected, onToggle, summary }: MultiSelectProps) {
  return (
    <Dropdown label={label} value={summary}>
      {() =>
        options.map((opt) => (
          <DropdownItem key={opt} kind="check" selected={selected.includes(opt)} onClick={() => onToggle(opt)}>
            {opt}
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
}
