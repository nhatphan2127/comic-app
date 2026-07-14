// src/components/Settings.tsx
import { useState, useEffect, useRef } from 'react';
import { Sparkle, Moon, Sun, X, ChevronRight } from 'lucide-react';
import { useTheme, type Theme } from '../context/ThemeContext';
// import '../assets/styles/Settings.css';
import { THEMES, FILTER_OPTIONS } from '../types/data';
import { getStoredContentFilter, setStoredContentFilter, type ContentFilter } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [contentFilter, setContentFilter] = useState<ContentFilter>(() => getStoredContentFilter());
  
  // Ref dùng để kiểm tra sự kiện click ngoài panel cài đặt
  const panelRef = useRef<HTMLDivElement>(null);

  // Xử lý click ngoài vùng modal và bấm phím ESC để đóng
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleContentFilterChange = (filter: ContentFilter) => {
    setContentFilter(filter);
    setStoredContentFilter(filter);
  };

  const handleReset = () => {
    // Reset về các giá trị mặc định của hệ thống
    setTheme('Main');
    const defaultFilter = (FILTER_OPTIONS[0]?.id || 'Safe') as ContentFilter;
    handleContentFilterChange(defaultFilter);
  };

  if (!isOpen) return null;

  // Render icon tương ứng sử dụng lucide-react với size=14 phù hợp layout ban đầu
  const getThemeIcon = (t: Theme) => {
    switch (t) {
      case 'Main':
        return <Sparkle size={14} />;
      case 'Dark':
        return <Moon size={14} />;
      case 'Light':
        return <Sun size={14} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop hỗ trợ việc click ra ngoài đóng modal */}
      <div className="settings-backdrop" onClick={onClose} />

      {/* Cấu trúc Dialog bên ngoài */}
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div ref={panelRef} className="settings-dialog__panel">
          <header className="settings-dialog__head">
            <div className="settings-dialog__head-left">
              <div>
                <h2 id="settings-title" className="settings-dialog__title">Settings</h2>
                <p className="settings-dialog__sub">Saved to this device. No account needed.</p>
              </div>
            </div>
            <button 
              type="button" 
              className="settings-dialog__close" 
              aria-label="Close"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </header>

          <div className="settings-dialog__body">
            {/* THEME */}
            <section className="settings-sec">
              <div className="settings-sec__head">
                <div className="settings-sec__label mono">THEME</div>
              </div>
              <div className="settings-seg">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`settings-seg__btn ${theme === t ? 'is-on' : ''}`}
                    onClick={() => setTheme(t)}
                  >
                    {getThemeIcon(t)}
                    {t}
                  </button>
                ))}
              </div>
            </section>

            {/* CONTENT FILTER */}
            <section className="settings-sec">
              <div className="settings-sec__head">
                <div className="settings-sec__label mono">CONTENT FILTER</div>
                <div className="settings-sec__hint">Applies to all pages.</div>
              </div>
              <div className="settings-radio">
                {FILTER_OPTIONS.map((option) => (
                  <label 
                    key={option.id} 
                    className={`settings-radio__row ${contentFilter === option.id ? 'is-on' : ''}`}
                  >
                    <input 
                      type="radio" 
                      name="content-filter"
                      checked={contentFilter === option.id}
                      onChange={() => handleContentFilterChange(option.id as ContentFilter)}
                    />
                    <span className="settings-radio__dot" aria-hidden="true"></span>
                    <span className="settings-radio__text">
                      <span className="settings-radio__title">
                        {option.label}
                        {option.recommended && (
                          <span className="settings-radio__badge">Recommended</span>
                        )}
                      </span>
                      <span className="settings-radio__sub">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <footer className="settings-dialog__foot">
            <button 
              type="button" 
              className="settings-dialog__reset"
              onClick={handleReset}
            >
              Reset to defaults
            </button>
            <div className="settings-dialog__foot-actions">
              <button 
                type="button" 
                className="settings-dialog__save"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}