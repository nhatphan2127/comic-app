import { useState, useEffect, useRef } from 'react';
import { Sparkle, Moon, Sun, X } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';
import styles from './FilterSettingsLayout.module.css';
import { THEMES, FILTER_OPTIONS } from '../../types/data';
import { getStoredContentFilter, setStoredContentFilter, type ContentFilter } from '../../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterSettingsLayout({ isOpen, onClose }: SettingsModalProps) {
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

  // Render icon tương ứng sử dụng lucide-react với size=14 phù hợp layout
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
    <div 
      className={styles['settings-dialog']} 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="settings-title"
    >
      <div ref={panelRef} className={styles['settings-dialog__panel']}>
        {/* HEADER */}
        <header className={styles['settings-dialog__head']}>
          <div className={styles['settings-dialog__head-left']}>
            <div>
              <h2 id="settings-title" className={styles['settings-dialog__title']}>
                Settings
              </h2>
              <p className={styles['settings-dialog__sub']}>
                Saved to this device. No account needed.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className={styles['settings-dialog__close']} 
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        {/* BODY */}
        <div className={styles['settings-dialog__body']}>
          {/* THEME SECTION */}
          <section className={styles['settings-sec']}>
            <div className={styles['settings-sec__head']}>
              <div className={`${styles['settings-sec__label']} ${styles['mono'] || 'mono'}`}>
                THEME
              </div>
            </div>
            <div className={styles['settings-seg']}>
              {THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles['settings-seg__btn']} ${theme === t ? styles['is-on'] : ''}`}
                  onClick={() => setTheme(t)}
                >
                  {getThemeIcon(t)}
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* CONTENT FILTER SECTION */}
          <section className={styles['settings-sec']}>
            <div className={styles['settings-sec__head']}>
              <div className={`${styles['settings-sec__label']} ${styles['mono'] || 'mono'}`}>
                CONTENT FILTER
              </div>
              <div className={styles['settings-sec__hint']}>
                Applies to all pages.
              </div>
            </div>
            <div className={styles['settings-radio']}>
              {FILTER_OPTIONS.map((option) => {
                const isChecked = contentFilter === option.id;
                return (
                  <label 
                    key={option.id} 
                    className={`${styles['settings-radio__row']} ${isChecked ? styles['is-on'] : ''}`}
                  >
                    <input 
                      type="radio" 
                      name="content-filter"
                      checked={isChecked}
                      onChange={() => handleContentFilterChange(option.id as ContentFilter)}
                    />
                    <span className={styles['settings-radio__dot']} aria-hidden="true"></span>
                    <span className={styles['settings-radio__text']}>
                      <span className={styles['settings-radio__title']}>
                        {option.label}
                        {option.recommended && (
                          <span className={styles['settings-radio__badge']}>Recommended</span>
                        )}
                      </span>
                      <span className={styles['settings-radio__sub']}>
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className={styles['settings-dialog__foot']}>
          <button 
            type="button" 
            className={styles['settings-dialog__reset']}
            onClick={handleReset}
          >
            Reset to defaults
          </button>
          <div className={styles['settings-dialog__foot-actions']}>
            <button 
              type="button" 
              className={styles['settings-dialog__save']}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}