import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type Theme } from '../../context/ThemeContext';
import { getStoredContentFilter, setStoredContentFilter, userApi, type ContentFilter } from '../../services/api';
import type { Preferences } from '../../types/types';
import {
  READER_SETTINGS_CHANGED,
  READER_SETTINGS_KEY,
  READER_SETTINGS_SYNCED,
} from '../../layout/MangaReaderLayout/useReaderSettings';

// The server stores lower-case themes and the content filter as an index.
const THEME_TO_SERVER: Record<Theme, NonNullable<Preferences['theme']>> = { Main: 'main', Dark: 'dark', Light: 'light' };
const THEME_FROM_SERVER: Record<string, Theme> = { main: 'Main', dark: 'Dark', light: 'Light' };
const FILTERS: ContentFilter[] = ['Safe', 'Suggestive', 'Erotica', 'Pornographic'];
const READER_SAVE_DELAY_MS = 1000;

const readLocalReader = (): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** A row that only holds registration defaults was never chosen by the user. */
const isUntouched = (p: Preferences | null | undefined) => !p || (p.reader == null && (p.theme ?? 'main') === 'main' && (p.filter ?? 1) === 1);

/**
 * Keeps theme, content filter and reader settings the same on every device of an account.
 * On login the account's settings win, unless the account never saved any: then this device's
 * settings are uploaded. Afterwards every change is saved to the account. Renders nothing.
 */
export default function PreferenceSync() {
  const userId = useAuth().user?.id;
  const { theme, setTheme } = useTheme();
  const synced = useRef(false);

  // Pull (or seed) once per login.
  useEffect(() => {
    synced.current = false;
    if (!userId) return;
    let cancelled = false;

    userApi
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        const pref = profile?.preference;
        if (isUntouched(pref)) {
          const reader = readLocalReader();
          return userApi.updatePreferences({
            theme: THEME_TO_SERVER[theme],
            filter: FILTERS.indexOf(getStoredContentFilter()),
            ...(reader && { reader }),
          });
        }
        if (pref?.theme && THEME_FROM_SERVER[pref.theme]) setTheme(THEME_FROM_SERVER[pref.theme]);
        if (typeof pref?.filter === 'number' && FILTERS[pref.filter]) setStoredContentFilter(FILTERS[pref.filter]);
        if (pref?.reader) {
          localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(pref.reader));
          window.dispatchEvent(new Event(READER_SETTINGS_SYNCED));
        }
      })
      .catch(() => undefined) // offline or logged out meanwhile: local settings still work
      .finally(() => {
        if (!cancelled) synced.current = true;
      });

    return () => {
      cancelled = true;
    };
    // `theme` is read once when seeding, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, setTheme]);

  // Push theme changes.
  useEffect(() => {
    if (!userId || !synced.current) return;
    userApi.updatePreferences({ theme: THEME_TO_SERVER[theme] }).catch(() => undefined);
  }, [theme, userId]);

  // Push content filter and (debounced, sliders fire often) reader setting changes.
  useEffect(() => {
    if (!userId) return;
    let timer: number | undefined;

    const onFilter = () => {
      if (synced.current) userApi.updatePreferences({ filter: FILTERS.indexOf(getStoredContentFilter()) }).catch(() => undefined);
    };
    const onReader = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const reader = readLocalReader();
        if (synced.current && reader) userApi.updatePreferences({ reader }).catch(() => undefined);
      }, READER_SAVE_DELAY_MS);
    };

    window.addEventListener('content-filter-changed', onFilter);
    window.addEventListener(READER_SETTINGS_CHANGED, onReader);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('content-filter-changed', onFilter);
      window.removeEventListener(READER_SETTINGS_CHANGED, onReader);
    };
  }, [userId]);

  return null;
}
