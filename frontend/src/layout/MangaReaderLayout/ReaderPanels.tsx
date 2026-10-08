import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Ban,
  Minus,
  MoveDown,
  MoveLeft,
  MoveRight,
  Plus,
  Search,
} from 'lucide-react';
import type { Chapter } from '../../types/types';
import { formatTimeAgo } from '../../helpers/formatDate';
import cx from '../../helpers/cx';
import type { ProgressPosition, ReaderSettings, ReadingDirection } from './useReaderSettings';
import styles from './MangaReaderLayout.module.css';

/* ======================= Settings ======================= */

const DIRECTIONS: { id: ReadingDirection; label: string; icon: typeof MoveDown }[] = [
  { id: 'ttb', label: 'Vertical', icon: MoveDown },
  { id: 'ltr', label: 'Left → right', icon: MoveRight },
  { id: 'rtl', label: 'Right → left', icon: MoveLeft },
];

const PROGRESS: { id: ProgressPosition; label: string; icon: typeof Ban }[] = [
  { id: 'left', label: 'Left', icon: ArrowLeftToLine },
  { id: 'top', label: 'Top', icon: ArrowUpToLine },
  { id: 'bottom', label: 'Bottom', icon: ArrowDownToLine },
  { id: 'right', label: 'Right', icon: ArrowRightToLine },
  { id: 'off', label: 'Hidden', icon: Ban },
];

interface SettingsPanelProps {
  settings: ReaderSettings;
  update: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  reset: () => void;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  iconOnly,
}: {
  value: T;
  options: { id: T; label: string; icon: typeof Ban }[];
  onChange: (v: T) => void;
  label: string;
  iconOnly?: boolean;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map(({ id, label: text, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          title={text}
          aria-label={text}
          className={cx(styles.segment, value === id && styles.segmentOn)}
          onClick={() => onChange(id)}
        >
          <Icon size={16} />
          {iconOnly ? null : <span>{text}</span>}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={styles.toggleRow}>
      <span>{label}</span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={cx(styles.switch, checked && styles.switchOn)} aria-hidden="true" />
    </label>
  );
}

export function ReaderSettingsPanel({ settings, update, reset }: SettingsPanelProps) {
  return (
    <div className={styles.settings}>
      <section>
        <h4 className={styles.settingLabel}>Reading direction</h4>
        <Segmented label="Reading direction" value={settings.direction} options={DIRECTIONS} onChange={(v) => update('direction', v)} />
      </section>

      <section>
        <h4 className={styles.settingLabel}>Page gap</h4>
        <div className={styles.stepper}>
          <button type="button" aria-label="Less gap" disabled={settings.gap <= 0} onClick={() => update('gap', settings.gap - 1)}>
            <Minus size={14} />
          </button>
          <span className="mono">{settings.gap} rem</span>
          <button type="button" aria-label="More gap" disabled={settings.gap >= 8} onClick={() => update('gap', settings.gap + 1)}>
            <Plus size={14} />
          </button>
        </div>
      </section>

      <section>
        <h4 className={styles.settingLabel}>Progress bar</h4>
        <Segmented label="Progress bar position" iconOnly value={settings.progress} options={PROGRESS} onChange={(v) => update('progress', v)} />
      </section>

      <section>
        <h4 className={styles.settingLabel}>
          Dim pages <span className={cx(styles.settingValue, 'mono')}>{settings.dim}%</span>
        </h4>
        <input
          type="range"
          className={styles.range}
          min={0}
          max={80}
          step={5}
          value={settings.dim}
          aria-label="Dim amount"
          onChange={(e) => update('dim', Number(e.target.value))}
        />
      </section>

      <section className={styles.toggles}>
        <Toggle label="Smooth scrolling" checked={settings.smoothScroll} onChange={(v) => update('smoothScroll', v)} />
        <Toggle label="Preload all pages" checked={settings.preloadAll} onChange={(v) => update('preloadAll', v)} />
        <Toggle label="Greyscale pages" checked={settings.greyscale} onChange={(v) => update('greyscale', v)} />
      </section>

      <button type="button" className="btn btn--ghost" onClick={reset}>
        Reset reader settings
      </button>
    </div>
  );
}

/* ======================= Chapter list ======================= */

interface ChapterListProps {
  chapters: Chapter[];
  currentId?: string;
  onSelect: (id: string) => void;
}

export function ReaderChapterList({ chapters, currentId, onSelect }: ChapterListProps) {
  const [query, setQuery] = useState('');
  const [desc, setDesc] = useState(true);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? chapters.filter((ch) => String(ch.chapterNumber).includes(q) || ch.title?.toLowerCase().includes(q))
      : chapters;
    return desc ? [...filtered].reverse() : filtered;
  }, [chapters, query, desc]);

  return (
    <div className={styles.chapterPanel}>
      <div className={styles.chapterTools}>
        <label className={styles.chapterSearch}>
          <Search size={14} />
          <input type="text" placeholder="Chapter number or title" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          title={desc ? 'Newest first' : 'Oldest first'}
          aria-label="Toggle sort order"
          onClick={() => setDesc((v) => !v)}
        >
          {desc ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
        </button>
      </div>

      <ul className={styles.chapterItems}>
        {list.map((ch) => (
          <li key={ch.id}>
            <button
              type="button"
              className={cx(styles.chapterItem, ch.id === currentId && styles.chapterItemOn)}
              aria-current={ch.id === currentId ? 'true' : undefined}
              onClick={() => onSelect(ch.id)}
            >
              <span className={styles.chapterItemNum}>Chapter {ch.chapterNumber}</span>
              {ch.title ? <span className={styles.chapterItemTitle}>{ch.title}</span> : null}
              <span className={styles.chapterItemTime}>{formatTimeAgo(ch.updatedAt || ch.createdAt)}</span>
            </button>
          </li>
        ))}
        {list.length === 0 ? <li className={styles.chapterEmpty}>No chapters found.</li> : null}
      </ul>
    </div>
  );
}

/* ======================= Keyboard help ======================= */

const SHORTCUTS: [string, string[]][] = [
  ['Scroll', ['↑', '↓', 'W', 'S']],
  ['Previous / next page', ['←', '→', 'A', 'D']],
  ['Previous chapter', ['B', '[']],
  ['Next chapter', ['N', ']']],
  ['Comments', ['M', 'C']],
  ['Fullscreen', ['F']],
  ['Show / hide controls', ['X']],
  ['This help', ['H', '?']],
  ['Close panel', ['Esc']],
];

export function ReaderShortcuts() {
  return (
    <ul className={styles.keys}>
      {SHORTCUTS.map(([desc, keys]) => (
        <li key={desc}>
          <span>{desc}</span>
          <span className={styles.keyChips}>
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
