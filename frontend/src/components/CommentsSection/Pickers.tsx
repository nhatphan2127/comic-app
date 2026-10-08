import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { EMOJI_CATEGORIES, codeToText, emojiFallback } from './emoji';
import useClickOutside from '../../hooks/useClickOutside';
import cx from '../../helpers/cx';
import styles from './CommentsSection.module.css';

/* ---------- Shared popover shell (flips above the trigger when there is no room below) ---------- */
function PickerPopover({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);
  useClickOutside(ref, onClose);

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setAbove(window.innerHeight - rect.top < rect.height && rect.top > rect.height);
  }, []);

  return (
    <div ref={ref} className={cx(styles.picker, above && styles.pickerAbove, className)}>
      {children}
    </div>
  );
}

function PickerSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className={styles.pickerSearch}>
      <Search size={14} />
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
    </label>
  );
}

/* ---------- Emoji ---------- */
export function EmojiPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (emoji: string) => void }) {
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMOJI_CATEGORIES;
    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => item.code.toLowerCase().includes(q)),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  const jumpTo = (name: string) => {
    const section = scrollRef.current?.querySelector<HTMLElement>(`[data-cat="${name}"]`);
    if (section && scrollRef.current) {
      scrollRef.current.scrollTo({ top: section.offsetTop - scrollRef.current.offsetTop, behavior: 'smooth' });
    }
  };

  return (
    <PickerPopover onClose={onClose}>
      <PickerSearch value={query} onChange={setQuery} placeholder="Search emoji" />

      <div className={styles.pickerScroll} ref={scrollRef}>
        {categories.map((cat) => (
          <div key={cat.name} data-cat={cat.name}>
            <div className={styles.pickerLabel}>{cat.name}</div>
            <div className={styles.emojiGrid}>
              {cat.items.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={styles.emojiBtn}
                  title={item.name}
                  onClick={() => onSelect(codeToText(item.code))}
                >
                  <img src={item.url} alt={item.name} loading="lazy" onError={(e) => emojiFallback(e, item.code)} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {categories.length === 0 ? <div className={styles.pickerEmpty}>No emoji found.</div> : null}
      </div>

      {!query.trim() ? (
        <nav className={styles.pickerTabs}>
          {EMOJI_CATEGORIES.map((cat) => (
            <button key={cat.name} type="button" title={cat.name} onClick={() => jumpTo(cat.name)}>
              {cat.icon}
            </button>
          ))}
        </nav>
      ) : null}
    </PickerPopover>
  );
}

/* ---------- GIF ---------- */
interface Gif {
  url: string;
  title: string;
}

const FALLBACK_GIFS: Gif[] = [
  { url: 'https://media.giphy.com/media/11Heub7KM9fGQ0/giphy.gif', title: 'Anime Happy' },
  { url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', title: 'Cat Shocked' },
  { url: 'https://media.giphy.com/media/10UUe8ZsLnaqwo/giphy.gif', title: 'Anime Dance' },
  { url: 'https://media.giphy.com/media/dd9BKfspX29gI/giphy.gif', title: 'Thumbs Up' },
  { url: 'https://media.giphy.com/media/S9oGIGwXf0HSM/giphy.gif', title: 'Cute Cry' },
  { url: 'https://media.giphy.com/media/HteV6h0c06T6/giphy.gif', title: 'Anime Smile' },
];

const GIPHY_KEY = 'dc6zaTOxFJmzC';
const TENOR_KEY = 'LIVDTRZ6A0VW';
const GIF_LIMIT = 12;

/** Tries Giphy, then Tenor; returns null if both fail. */
async function fetchGifs(query: string, signal: AbortSignal): Promise<Gif[] | null> {
  const q = encodeURIComponent(query);
  try {
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${q}&limit=${GIF_LIMIT}`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=${GIF_LIMIT}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const { data } = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: { title?: string; images: Record<string, { url?: string }> }) => ({
          url: item.images.fixed_width_small?.url || item.images.fixed_width_downsampled?.url || item.images.original?.url || '',
          title: item.title || 'GIF',
        }));
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
  }

  try {
    const url = query
      ? `https://g.tenor.com/v1/search?q=${q}&key=${TENOR_KEY}&limit=${GIF_LIMIT}`
      : `https://g.tenor.com/v1/trending?key=${TENOR_KEY}&limit=${GIF_LIMIT}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const { results } = await res.json();
      if (Array.isArray(results)) {
        return results.map((item: { title?: string; media?: Array<Record<string, { url?: string }>> }) => ({
          url: item.media?.[0]?.tinygif?.url || item.media?.[0]?.gif?.url || '',
          title: item.title || 'GIF',
        }));
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
  }

  return null;
}

export function GifPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (url: string, title: string) => void }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchGifs(query.trim(), controller.signal)
        .then((result) => setGifs(result ?? FALLBACK_GIFS))
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <PickerPopover onClose={onClose} className={styles.gifPicker}>
      <PickerSearch value={query} onChange={setQuery} placeholder="Search GIFs" />
      <div className={styles.pickerScroll}>
        {loading ? (
          <div className={styles.pickerEmpty}>Loading GIFs…</div>
        ) : gifs.length === 0 ? (
          <div className={styles.pickerEmpty}>No GIFs found.</div>
        ) : (
          <div className={styles.gifGrid}>
            {gifs.map((gif, i) => (
              <button
                key={`${gif.url}-${i}`}
                type="button"
                className={styles.gifBtn}
                onClick={() => {
                  onSelect(gif.url, gif.title);
                  onClose();
                }}
              >
                <img src={gif.url} alt={gif.title} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </PickerPopover>
  );
}
