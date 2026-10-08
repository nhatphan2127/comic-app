import { useCallback, useEffect, useState } from 'react';

export type ReadingDirection = 'ltr' | 'rtl' | 'ttb';
export type ProgressPosition = 'left' | 'top' | 'bottom' | 'right' | 'off';

export interface ReaderSettings {
  direction: ReadingDirection;
  /** Page width as a % of the viewport (strip / single page). */
  width: number;
  /** Gap between pages in long-strip mode, in rem. */
  gap: number;
  smoothScroll: boolean;
  progress: ProgressPosition;
  preloadAll: boolean;
  greyscale: boolean;
  /** 0–80, percentage to darken pages. */
  dim: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  direction: 'ttb',
  width: 60,
  gap: 0,
  smoothScroll: true,
  progress: 'bottom',
  preloadAll: false,
  greyscale: false,
  dim: 0,
};

export const WIDTH_LIMITS = { min: 30, max: 100, step: 10 } as const;
export const READER_SETTINGS_KEY = 'reader-settings';
const STORAGE_KEY = READER_SETTINGS_KEY;
/** Fired after the user changes a setting (PreferenceSync saves it to the account). */
export const READER_SETTINGS_CHANGED = 'reader-settings-changed';
/** Fired after settings were replaced from the account (an open reader reloads them). */
export const READER_SETTINGS_SYNCED = 'reader-settings-synced';

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(raw) } : DEFAULT_READER_SETTINGS;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

/** Reader preferences, persisted to localStorage and, when logged in, to the account. */
export default function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  }, [settings]);

  useEffect(() => {
    const reload = () => setSettings(load());
    window.addEventListener(READER_SETTINGS_SYNCED, reload);
    return () => window.removeEventListener(READER_SETTINGS_SYNCED, reload);
  }, []);

  // Only real user changes are announced, not the initial load.
  const announce = () => window.dispatchEvent(new Event(READER_SETTINGS_CHANGED));

  const update = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    announce();
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_READER_SETTINGS);
    announce();
  }, []);

  return { settings, update, reset };
}
