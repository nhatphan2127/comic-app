import { type Theme } from '../context/ThemeContext';

// Settings.tsx
export const THEMES: Theme[] = ['Main', 'Dark', 'Light'];

export const FILTER_OPTIONS = [
  { 
    id: 'Safe', 
    label: 'Safe', 
    description: 'Family-friendly content suitable for all ages. No mature themes.' 
  },
  { 
    id: 'Suggestive', 
    label: 'Suggestive', 
    description: 'Includes mild fan service, romantic themes, and suggestive content.', 
    recommended: true 
  },
  { 
    id: 'Erotica', 
    label: 'Erotica', 
    description: 'Includes sexual content, violence, and mature themes. Not explicit pornography.' 
  },
  { 
    id: 'Pornographic', 
    label: 'Pornographic', 
    description: 'All content including explicit sexual material.' 
  }
];

