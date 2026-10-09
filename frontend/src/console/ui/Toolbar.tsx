import { useEffect, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import style from './ui.module.css';

/** Row of filters above a list; wraps on small screens. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={style.toolbar}>{children}</div>;
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Waits this long after the last keystroke before calling onChange (for server-side search). */
  debounceMs?: number;
}

export function SearchField({ value, onChange, placeholder = 'Search…', debounceMs = 0 }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!debounceMs || draft === value) return;
    const timer = window.setTimeout(() => onChange(draft), debounceMs);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange, debounceMs]);

  return (
    <label className={style.search}>
      <Search size={15} />
      <input
        type="search"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (!debounceMs) onChange(e.target.value);
        }}
      />
    </label>
  );
}
