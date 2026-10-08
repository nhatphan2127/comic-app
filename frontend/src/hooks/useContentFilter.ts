import { useEffect, useState } from 'react';
import { getStoredContentFilter, type ContentFilter } from '../services/api';

/** Keeps the content filter in sync with the settings panel and other tabs. */
export default function useContentFilter() {
  const [filter, setFilter] = useState<ContentFilter>(() => getStoredContentFilter());

  useEffect(() => {
    const sync = () => setFilter(getStoredContentFilter());
    window.addEventListener('content-filter-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('content-filter-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return filter;
}
