import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './AuthForm.module.css';

/** Shared building blocks for the login / register forms. */

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  aside?: ReactNode;
}

export function AuthField({ label, aside, id, ...inputProps }: FieldProps) {
  const inputId = id ?? `auth-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId}>{label}</label>
        {aside}
      </div>
      <input id={inputId} className={styles.input} {...inputProps} />
    </div>
  );
}
