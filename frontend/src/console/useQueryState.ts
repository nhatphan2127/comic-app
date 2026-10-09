import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter state kept in the URL (?status=pending&page=2), so a console screen survives reloads and can be
 * linked to. Changing any key other than `page` sends the list back to page 1.
 */
export default function useQueryState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) ?? fallback])) as T;

  const set = useCallback(
    (changes: Partial<T>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
            else next.set(key, value);
          });
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // `defaults` is a literal at each call site; its values never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  return [values, set] as const;
}
