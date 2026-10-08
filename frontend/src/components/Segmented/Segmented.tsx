import type { ReactNode } from 'react';
import cx from '../../helpers/cx';
import styles from './Segmented.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/** Pill-style single-choice toggle group. */
export default function Segmented<T extends string>({ value, options, onChange, ariaLabel, className }: SegmentedProps<T>) {
  return (
    <div className={cx(styles.group, className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          className={cx(styles.option, value === opt.value && styles.on)}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count ? <span className={cx(styles.count, 'mono')}>{opt.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
