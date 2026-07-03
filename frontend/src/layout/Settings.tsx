// src/components/Settings.tsx
import { useState } from 'react';
import { Sparkle, Moon, Sun, X } from 'lucide-react';
import { useTheme, type Theme } from '../context/ThemeContext';
import '../assets/styles/Settings.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tách các biến cấu hình tĩnh ra khỏi component để tránh khởi tạo lại mỗi lần render
const THEMES: Theme[] = ['Main', 'Dark', 'Light'];

const FILTER_OPTIONS = [
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

export default function Settings({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [contentFilter, setContentFilter] = useState('Suggestive');

  if (!isOpen) return null;

  // Hàm helper lấy icon tương ứng với giao diện
  const getThemeIcon = (t: Theme) => {
    switch (t) {
      case 'Main':
        return <Sparkle className="w-3.5 h-3.5" />;
      case 'Dark':
        return <Moon className="w-3.5 h-3.5" />;
      case 'Light':
        return <Sun className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="settings-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="settings-info">Saved to this device. No account needed.</p>

        {/* Theme Section */}
        <div className="settings-section">
          <h3 className="section-title">THEME</h3>
          <div className="theme-options">
            {THEMES.map((t) => (
              <button
                key={t}
                className={`theme-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {getThemeIcon(t)}
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content Filter Section */}
        <div className="settings-section">
          <div className="section-header">
            <h3 className="section-title">CONTENT FILTER</h3>
            <span className="applies-text">Applies to all pages.</span>
          </div>
          <div className="content-filter-options">
            {FILTER_OPTIONS.map((option) => (
              <div
                key={option.id}
                className={`filter-option ${contentFilter === option.id ? 'selected' : ''}`}
                onClick={() => setContentFilter(option.id)}
              >
                <input
                  type="radio"
                  name="contentFilter"
                  value={option.id}
                  checked={contentFilter === option.id}
                  onChange={() => setContentFilter(option.id)}
                />
                <div className="filter-label">
                  <span className="filter-title">
                    {option.label}{' '}
                    {option.recommended && (
                      <span className="recommended-badge">RECOMMENDED</span>
                    )}
                  </span>
                  <span className="filter-description">{option.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}