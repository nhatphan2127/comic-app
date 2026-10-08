import { API_UPLOADS } from '../services/api';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';

/**
 * Turns a stored upload path into a full URL.
 * Absolute (http/https), data: and blob: URLs are returned unchanged; empty input returns null.
 */
export const resolveUploadUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_UPLOADS}${path.replace(/^\/+/, '')}`;
};

/** Cover image URL with a placeholder fallback. */
export const getImage = (coverUrl?: string | null) => resolveUploadUrl(coverUrl) ?? FALLBACK_COVER;
