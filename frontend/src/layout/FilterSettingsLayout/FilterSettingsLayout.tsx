import { Moon, Sparkle, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';
import { THEMES, FILTER_OPTIONS } from '../../types/data';
import { DEFAULT_CONTENT_FILTER, setStoredContentFilter, type ContentFilter } from '../../services/api';
import useContentFilter from '../../hooks/useContentFilter';
import Modal from '../../components/Modal/Modal';
import cx from '../../helpers/cx';
import styles from './FilterSettingsLayout.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_ICONS: Record<Theme, typeof Sun> = { Main: Sparkle, Dark: Moon, Light: Sun };

export default function FilterSettingsLayout({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  // Follows the stored value, which can also change from another tab or the account sync.
  const contentFilter = useContentFilter();
  const changeFilter = (filter: ContentFilter) => setStoredContentFilter(filter);

  const reset = () => {
    setTheme('Main');
    changeFilter(DEFAULT_CONTENT_FILTER);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="side"
      title="Settings"
      subtitle="Saved on this device, and to your account when you are signed in."
      footer={
        <>
          <button type="button" className={styles.resetBtn} onClick={reset}>
            Reset to defaults
          </button>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>Theme</h3>
        <div className={styles.themeGrid}>
          {THEMES.map(({ id, label }) => {
            const Icon = THEME_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                className={cx(styles.themeCard, theme === id && styles.themeCardOn)}
                data-preview={id.toLowerCase()}
                aria-pressed={theme === id}
                onClick={() => setTheme(id)}
              >
                <span className={styles.themeSwatch} aria-hidden="true">
                  <span />
                  <span />
                </span>
                <span className={styles.themeName}>
                  <Icon size={14} />
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>Content filter</h3>
        <p className={styles.sectionHint}>Applies across every page.</p>

        <div className={styles.options} role="radiogroup">
          {FILTER_OPTIONS.map((option) => {
            const checked = contentFilter === option.id;
            return (
              <label key={option.id} className={cx(styles.option, checked && styles.optionOn)}>
                <input
                  type="radio"
                  name="content-filter"
                  className="sr-only"
                  checked={checked}
                  onChange={() => changeFilter(option.id)}
                />
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.optionText}>
                  <span className={styles.optionTitle}>
                    {option.label}
                    {option.recommended ? <span className={styles.badge}>Recommended</span> : null}
                  </span>
                  <span className={styles.optionDesc}>{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </Modal>
  );
}
