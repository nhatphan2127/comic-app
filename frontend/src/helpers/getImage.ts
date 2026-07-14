import { API_UPLOADS } from "../services/api";

export const getImage = (coverUrl?: string) => {
  if (!coverUrl) return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }
  return `${API_UPLOADS}${coverUrl}`;
};