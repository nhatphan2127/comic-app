import type { Theme } from '../context/ThemeContext';
import type { ContentFilter } from '../services/api';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'Main', label: 'Warm' },
  { id: 'Dark', label: 'Midnight' },
  { id: 'Light', label: 'Paper' },
];

export const FILTER_OPTIONS: { id: ContentFilter; label: string; description: string; recommended?: boolean }[] = [
  {
    id: 'Safe',
    label: 'Safe',
    description: 'Family-friendly content suitable for all ages. No mature themes.',
  },
  {
    id: 'Suggestive',
    label: 'Suggestive',
    description: 'Includes mild fan service, romantic themes, and suggestive content.',
    recommended: true,
  },
  {
    id: 'Erotica',
    label: 'Erotica',
    description: 'Includes sexual content, violence, and mature themes. Not explicit pornography.',
  },
  {
    id: 'Pornographic',
    label: 'Pornographic',
    description: 'All content including explicit sexual material.',
  },
];
