import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { comicApi, commentApi, chapterApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../layout/AuthModalLayout/AuthModalLayout';
import type { Comment } from '../../types/types';
import getAvatarBg from '../../helpers/getAvatarBg';
import styles from './CommentsSection.module.css';

// ─── TỰ ĐỘNG ĐỌC VÀ ÁP DỤNG TRỰC TIẾP TỪ THƯ MỤC PUBLIC ───
const emojiGlob = import.meta.glob('/src/assets/emojis/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

const CATEGORIZED_EMOJIS: Record<string, { code: string; name: string; url: string }[]> = {};
const ALL_EMOJIS_MAP = new Map<string, string>();

Object.entries(emojiGlob).forEach(([path, url]) => {
  const match = path.match(/\/src\/assets\/emojis\/([^/]+)\/(.+)\.webp$/);
  if (match) {
    const [_, folderName, code] = match;
    const categoryName = folderName.replace('___', ' & ');
    
    if (!CATEGORIZED_EMOJIS[categoryName]) {
      CATEGORIZED_EMOJIS[categoryName] = [];
    }
    
    CATEGORIZED_EMOJIS[categoryName].push({
      code,
      name: code.toUpperCase(),
      url
    });

    const cleanCode = code.toLowerCase().replace('_fe0f', '');
    ALL_EMOJIS_MAP.set(cleanCode, url);
  }
});

const codeToUnicode = (code: string): string => {
  if (code === 'PACMAN') return ':pacman:';
  if (code === 'LIKE') return ':like:';
  if (code === 'FACE_WITH_COLON_THREE') return ':colonthree:';
  try {
    return code
      .split('_')
      .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
      .join('');
  } catch {
    return `:${code}:`;
  }
};

const charToCode = (char: string): string => {
  return Array.from(char)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((hex) => hex !== 'fe0f')
    .join('_');
};

const getEmojiImgSrc = (partOrCode: string): string => {
  let targetCode = partOrCode;
  if (partOrCode.startsWith(':') && partOrCode.endsWith(':')) {
    const short = partOrCode.slice(1, -1);
    if (short === 'pacman') targetCode = 'PACMAN';
    else if (short === 'like') targetCode = 'LIKE';
    else if (short === 'colonthree') targetCode = 'FACE_WITH_COLON_THREE';
    else targetCode = short;
  } else if (partOrCode.length > 0 && !/[a-zA-Z0-9_]/.test(partOrCode[0])) {
    targetCode = charToCode(partOrCode);
  }
  
  const cleanTargetCode = targetCode.toLowerCase().replace('_fe0f', '');
  return ALL_EMOJIS_MAP.get(cleanTargetCode) || '';
};

const insertFormatting = (
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  setValue: React.Dispatch<React.SetStateAction<string>>
) => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);
  const replacement = before + selected + after;
  setValue(text.substring(0, start) + replacement + text.substring(end));
  
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  }, 0);
};

const getUnicodeFlagIcon = (code: string) => {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
};

const FALLBACK_GIFS = [
  { url: 'https://media.giphy.com/media/11Heub7KM9fGQ0/giphy.gif', title: 'Anime Happy' },
  { url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', title: 'Cat Shocked' },
  { url: 'https://media.giphy.com/media/10UUe8ZsLnaqwo/giphy.gif', title: 'Anime Dance' },
  { url: 'https://media.giphy.com/media/dd9BKfspX29gI/giphy.gif', title: 'Thumbs Up' },
  { url: 'https://media.giphy.com/media/S9oGIGwXf0HSM/giphy.gif', title: 'Cute Cry' },
  { url: 'https://media.giphy.com/media/HteV6h0c06T6/giphy.gif', title: 'Anime Smile' },
  { url: 'https://media.giphy.com/media/9PxJYX3gkbvUybHMBA/giphy.gif', title: 'Wow Anime' },
  { url: 'https://media.giphy.com/media/3ornk57KwDXf81rjWM/giphy.gif', title: 'Popcorn Chill' },
];

function SpoilerText({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span 
      className={`${styles['cm-spoiler']} ${revealed ? styles['is-revealed'] : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setRevealed(!revealed);
      }}
    >
      {children}
    </span>
  );
}

const getEmojiFallbackSrc = (e: React.SyntheticEvent<HTMLImageElement, Event>, code: string) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = `https://emoji.fbicons.net/fb24/${code}.webp`;
};

const MISC_FLAGS: string[] = []; 
const FLAG_OBJECTS: { code: string }[] = [];

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let isQuote = false;
    let content = line;
    if (line.startsWith('> ')) {
      isQuote = true;
      content = line.substring(2);
    }
    
    const regex = /(\*\*.*?\*\*|\*.*?\*|\|\|.*?\|\||!\[.*?\]\(.*?\)|[\uD800-\uDBFF][\uDC00-\uDFFF][\u200D\uFE0F]*|[\u2600-\u27BF][\uFE0F]*|\:[a-zA-Z0-9_]+\:)/g;
    const parts = content.split(regex);
    const parsedInline = parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('||') && part.endsWith('||')) {
        return <SpoilerText key={index}>{part.slice(2, -2)}</SpoilerText>;
      }
      if (part.startsWith('![') && part.endsWith(')')) {
        const match = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <img 
              key={index} 
              src={match[2]} 
              alt={match[1]} 
              className={styles['cm-inline-img']} 
            />
          );
        }
      }

      const emojiUrl = getEmojiImgSrc(part);
      if (emojiUrl) {
        return (
          <img
            key={index}
            src={emojiUrl}
            onError={(e) => {
              const code = part.startsWith(':') ? part.slice(1, -1) : charToCode(part);
              getEmojiFallbackSrc(e, code);
            }}
            alt={part}
            className={styles['cm-inline-emoji']}
            style={{
              width: '20px',
              height: '20px',
              display: 'inline-block',
              verticalAlign: 'middle',
              margin: '0 2px'
            }}
          />
        );
      }

      return part;
    });

    if (isQuote) {
      return (
        <blockquote key={lineIdx} className={styles['cm-quote']}>
          {parsedInline}
        </blockquote>
      );
    }

    return <div key={lineIdx} className={styles['cm-line']}>{parsedInline}</div>;
  });
}

// ─── EMOJI SEPARATE POPUP ───
interface EmojiPopoverProps {
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

function EmojiPopover({ onClose, onSelect }: EmojiPopoverProps) {
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<'below' | 'above'>('below');

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles['cm-editor__tool--active']}`)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [onClose]);

  useLayoutEffect(() => {
    if (popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      const height = rect.height || 350;
      const spaceBelow = window.innerHeight - rect.top;
      if (spaceBelow < height && rect.top > height) {
        setPosition('above');
      } else {
        setPosition('below');
      }
    }
  }, []);

  const groupedCategories = useMemo(() => {
    const getCategoryIcon = (category: string) => {
      switch (category) {
        case 'Smileys & Emotion': return '😀';
        case 'Gestures & Body': return '👋';
        case 'People & Fantasy': return '🦸';
        case 'Animals & Nature': return '🐶';
        case 'Food & Drink': return '🍔';
        case 'Travel & Places': return '✈️';
        case 'Objects & Tools': return '💡';
        case 'Symbols & Flags': return '🏁';
        default: return '🌟';
      }
    };

    return Object.entries(CATEGORIZED_EMOJIS).map(([catName, items]) => {
      let catItems = [...items];
      if (catName === 'Symbols & Flags') {
        catItems = [
          ...catItems,
          ...MISC_FLAGS.map(f => ({ code: f, name: f, url: '', isNative: true })),
          ...FLAG_OBJECTS.map(flag => ({ code: flag.code, name: flag.code, url: '', isFlag: true }))
        ];
      }

      return {
        name: catName,
        icon: getCategoryIcon(catName),
        items: catItems
      };
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return groupedCategories;
    return groupedCategories.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
      )
    })).filter((cat) => cat.items.length > 0);
  }, [search, groupedCategories]);

  const scrollToSection = (catName: string) => {
    const el = document.getElementById(`cat-${catName}`);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: el.offsetTop - scrollRef.current.offsetTop,
        behavior: 'smooth'
      });
    }
  };

  const handleEmojiClick = (code: string, isFlag?: boolean, isNative?: boolean) => {
    if (isFlag) {
      onSelect(getUnicodeFlagIcon(code));
    } else if (isNative) {
      onSelect(code);
    } else {
      onSelect(codeToUnicode(code));
    }
  };

  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    zIndex: 1000,
    ...(position === 'above'
      ? { bottom: '100%', top: 'auto', marginBottom: '8px' }
      : { top: '100%', bottom: 'auto', marginTop: '8px' }
    )
  };

  return (
    <div className={styles['fb-emoji-popup']} ref={popoverRef} style={popoverStyle}>
      <div className={styles['fb-popup-search-box']}>
        <svg className={styles['fb-search-icon']} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className={styles['fb-popup-input']}
          placeholder="Tìm kiếm biểu tượng cảm xúc"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles['fb-popup-scroll-container']} ref={scrollRef}>
        {filtered.map((cat) => (
          <div key={cat.name} id={`cat-${cat.name}`} className={styles['fb-emoji-section']}>
            <span className={styles['fb-emoji-section__title']}>{cat.name}</span>
            <div className={styles['fb-emoji-grid']}>
              {cat.items.map((item, idx) => {
                if ('isFlag' in item && item.isFlag) {
                  return (
                    <button
                      key={`${item.code}-${idx}`}
                      type="button"
                      className={`${styles['fb-emoji-btn']} ${styles['fb-flag-btn']}`}
                      onClick={() => handleEmojiClick(item.code, true)}
                      style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {getUnicodeFlagIcon(item.code)}
                    </button>
                  );
                }

                if ('isNative' in item && item.isNative) {
                  return (
                    <button
                      key={`${item.code}-${idx}`}
                      type="button"
                      className={styles['fb-emoji-btn']}
                      onClick={() => handleEmojiClick(item.code, false, true)}
                    >
                      {item.code}
                    </button>
                  );
                }
                
                return (
                  <button
                    key={`${item.code}-${idx}`}
                    type="button"
                    className={styles['fb-emoji-btn']}
                    title={item.name}
                    onClick={() => handleEmojiClick(item.code)}
                    style={{ padding: '4px' }}
                  >
                    <img
                      src={item.url}
                      onError={(e) => getEmojiFallbackSrc(e, item.code)}
                      alt={item.name}
                      style={{ width: '22px', height: '22px', display: 'block' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className={styles['fb-popup-empty']}>Không tìm thấy kết quả.</div>}
      </div>

      {!search.trim() && (
        <div className={styles['fb-emoji-footer-nav']} style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {groupedCategories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              className={styles['fb-footer-nav-btn']}
              title={cat.name}
              onClick={() => scrollToSection(cat.name)}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GIF SEPARATE POPUP ───
interface GifPopoverProps {
  onClose: () => void;
  onSelect: (gifUrl: string, gifTitle: string) => void;
}

function GifPopover({ onClose, onSelect }: GifPopoverProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<{ url: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<'below' | 'above'>('below');

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles['cm-editor__tool--active']}`)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [onClose]);

  useLayoutEffect(() => {
    if (popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      const height = rect.height || 350;
      const spaceBelow = window.innerHeight - rect.top;
      if (spaceBelow < height && rect.top > height) {
        setPosition('above');
      } else {
        setPosition('below');
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const delayDebounce = setTimeout(() => {
      setLoading(true);

      const fetchGifs = async () => {
        const giphyKey = 'dc6zaTOxFJmzC'; 
        const giphyUrl = search.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(search)}&limit=12`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyKey}&limit=12`;

        try {
          const res = await fetch(giphyUrl, { signal: controller.signal });
          if (!res.ok) throw new Error('Giphy failure');
          const data = await res.json();
          if (data && Array.isArray(data.data) && data.data.length > 0) {
            const downsampled = data.data.map((item: any) => ({
              url: item.images.fixed_width_small?.url || item.images.fixed_width_downsampled?.url || item.images.original?.url,
              title: item.title || 'GIF'
            }));
            setGifs(downsampled);
            return;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          console.warn('Giphy key expired or failed, attempting Tenor fallback search...');
        }

        try {
          const tenorUrl = search.trim()
            ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(search)}&key=LIVDTRZ6A0VW&limit=12`
            : `https://g.tenor.com/v1/trending?key=LIVDTRZ6A0VW&limit=12`;

          const res = await fetch(tenorUrl, { signal: controller.signal });
          if (!res.ok) throw new Error('Tenor lookup failed');
          const data = await res.json();
          if (data && Array.isArray(data.results)) {
            const tenorGifs = data.results.map((item: any) => {
              const mediaObj = item.media?.[0];
              return {
                url: mediaObj?.tinygif?.url || mediaObj?.gif?.url || '',
                title: item.title || 'GIF'
              };
            });
            setGifs(tenorGifs);
            return;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          console.error('All remote APIs rate-limited. Displaying fallback reaction options.');
        }

        setGifs(FALLBACK_GIFS);
      };

      fetchGifs().finally(() => {
        setLoading(false);
      });
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(delayDebounce);
    };
  }, [search]);

  const handleGifClick = (gifUrl: string, title: string) => {
    onSelect(gifUrl, title);
    setSearch('');
    onClose();
  };

  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    zIndex: 1000,
    ...(position === 'above'
      ? { bottom: '100%', top: 'auto', marginBottom: '8px' }
      : { top: '100%', bottom: 'auto', marginTop: '8px' }
    )
  };

  return (
    <div className={styles['fb-gif-popup']} ref={popoverRef} style={popoverStyle}>
      <div className={styles['fb-popup-search-box']}>
        <svg className={styles['fb-search-icon']} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className={styles['fb-popup-input']}
          placeholder="Tìm kiếm GIF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles['fb-popup-scroll-container']}>
        {loading ? (
          <div className={styles['fb-popup-empty']}>Đang tải GIF…</div>
        ) : (
          <div className={styles['fb-gif-masonry']}>
            {gifs.map((gif, idx) => (
              <button
                key={`${gif.url}-${idx}`}
                type="button"
                className={styles['fb-gif-btn']}
                onClick={() => handleGifClick(gif.url, gif.title)}
              >
                <img src={gif.url} alt={gif.title} loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {!loading && gifs.length === 0 && <div className={styles['fb-popup-empty']}>Không tìm thấy GIF nào.</div>}
      </div>
    </div>
  );
}

// ─── REUSABLE COMMENT FORM EDITOR ───
interface CommentFormEditorProps {
  placeholder: string;
  initialValue?: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  submitButtonText: string;
  autoFocus?: boolean;
}

function CommentFormEditor({ placeholder, initialValue = '', onSubmit, onCancel, submitButtonText, autoFocus = false }: CommentFormEditorProps) {
  const [text, setText] = useState(initialValue);
  const [isPreview, setIsPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [openPopup, setOpenPopup] = useState<'emoji' | 'gif' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    insertFormatting(textarea, before, after, setText);
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    setText(currentText.substring(0, start) + emoji + currentText.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleGifSelect = (gifUrl: string, gifTitle: string) => {
    const textarea = textareaRef.current;
    const replacement = `![${gifTitle}](${gifUrl})`;
    if (!textarea) {
      setText((prev) => prev + '\n' + replacement + '\n');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    setText(currentText.substring(0, start) + replacement + currentText.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      handleInsert('**', '**');
    } else if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      handleInsert('*', '*');
    } else if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      handleInsert('||', '||');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSubmit(text);
      setText('');
      setIsPreview(false);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form className={styles['cm-editor']} onSubmit={handleFormSubmit}>
      {isPreview ? (
        <div className={`${styles['cm-editor__input']} ${styles['content-rendered']} ${styles['markdown-preview']}`}>
          {text.trim() ? parseMarkdown(text) : <span style={{ opacity: 0.5 }}>Nothing to preview…</span>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={`${styles['input']} ${styles['input--area']} ${styles['cm-editor__input']}`}
          placeholder={placeholder}
          rows={2}
          style={{ height: '60px' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />
      )}
      <div style={{ height: 'auto', overflow: 'visible', transition: 'height 220ms' }}>
        <div className={styles['cm-editor__bar']}>
          <div className={styles['cm-editor__toolbar']} role="toolbar" aria-label="Formatting" style={{ position: 'relative' }}>
            <button 
              type="button" 
              className={styles['cm-editor__tool']} 
              aria-label="Bold" 
              title="Bold (Ctrl+B)"
              onClick={() => handleInsert('**', '**')}
              disabled={isPreview}
            >
              <strong>B</strong>
            </button>
            <button 
              type="button" 
              className={styles['cm-editor__tool']} 
              aria-label="Italic" 
              title="Italic (Ctrl+I)"
              onClick={() => handleInsert('*', '*')}
              disabled={isPreview}
              style={{ fontStyle: 'italic' }}
            >
              I
            </button>
            <button 
              type="button" 
              className={styles['cm-editor__tool']} 
              aria-label="Quote" 
              title="Quote"
              onClick={() => handleInsert('> ', '')}
              disabled={isPreview}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7h4v4H8c0 2 0 3 2 4"></path>
                <path d="M15 7h4v4h-3c0 2 0 3 2 4"></path>
              </svg>
            </button>
            <button 
              type="button" 
              className={styles['cm-editor__tool']} 
              aria-label="Spoiler" 
              title="Spoiler (Ctrl+E)"
              onClick={() => handleInsert('||', '||')}
              disabled={isPreview}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18"></path>
                <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c7 0 11 7 11 7a17.6 17.6 0 0 1-3.2 4.4"></path>
                <path d="M6.6 6.6A17.7 17.7 0 0 0 1 13s4 7 11 7a9.7 9.7 0 0 0 5.4-1.6"></path>
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
              </svg>
            </button>
            <div className={styles['cm-editor__tool-wrap']}>
              <button 
                type="button" 
                className={styles['cm-editor__tool']} 
                aria-label="Image" 
                title="Image"
                onClick={() => {
                  const url = prompt('Enter image URL:');
                  if (url) {
                    handleInsert(`![Image](${url})`, '');
                  }
                }}
                disabled={isPreview}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  <circle cx="9" cy="9" r="2"></circle>
                  <path d="M21 15l-5-5L5 21"></path>
                </svg>
              </button>
            </div>
            
            {/* Separate Emoji Popup Button */}
            <div className={styles['cm-editor__tool-wrap']}>
              <button 
                type="button" 
                className={`${styles['cm-editor__tool']} ${openPopup === 'emoji' ? styles['cm-editor__tool--active'] : ''}`} 
                aria-label="Biểu tượng cảm xúc" 
                title="Emoji Picker"
                onClick={() => setOpenPopup(openPopup === 'emoji' ? null : 'emoji')}
                disabled={isPreview}
              >
                <img src={getEmojiImgSrc('1f600') || '/emojis/Smileys__Emotion/1f600.webp'} onError={(e) => getEmojiFallbackSrc(e, '1f600')} alt="😀" style={{ width: '15px', height: '15px' }} />
              </button>
              {openPopup === 'emoji' && (
                <EmojiPopover
                  onClose={() => setOpenPopup(null)}
                  onSelect={handleEmojiSelect}
                />
              )}
            </div>

            {/* Separate GIF Popup Button */}
            <div className={styles['cm-editor__tool-wrap']}>
              <button 
                type="button" 
                className={`${styles['cm-editor__tool']} ${openPopup === 'gif' ? styles['cm-editor__tool--active'] : ''}`} 
                aria-label="GIF" 
                title="GIF Search"
                onClick={() => setOpenPopup(openPopup === 'gif' ? null : 'gif')}
                disabled={isPreview}
              >
                🎬
              </button>
              {openPopup === 'gif' && (
                <GifPopover
                  onClose={() => setOpenPopup(null)}
                  onSelect={handleGifSelect}
                />
              )}
            </div>

            {/* Preview Toggle */}
            <button 
              type="button" 
              className={`${styles['cm-editor__tool']} ${isPreview ? styles['cm-editor__tool--active'] : ''}`} 
              aria-pressed={isPreview} 
              aria-label="Show preview" 
              title="Show preview"
              onClick={() => setIsPreview(!isPreview)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>

          <div className={styles['cm-editor__actions']}>
            {onCancel && (
              <button type="button" className={`${styles['ubtn']} ${styles['ubtn--ghost']}`} onClick={onCancel} disabled={isSending}>
                Cancel
              </button>
            )}
            <button type="submit" className={`${styles['ubtn']} ${styles['ubtn--primary']}`} disabled={!text.trim() || isSending}>
              {submitButtonText}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─── COMPONENT CON: RECURSIVE COMMENT NODE ───
interface CommentNodeProps {
  comment: Comment;
  depth?: number;
  onReplySubmit: (parentId: string, text: string) => Promise<void>;
  onReact: (commentId: string, reaction: 'like' | 'dislike' | 'none') => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onEdit?: (commentId: string, text: string) => Promise<void>;
  canInteract: boolean;
  onRequireAuth: () => void;
  currentUserId?: string;
  targetId?: string;
}

function CommentNode({ comment, depth = 0, onReplySubmit, onReact, onDelete, onEdit, canInteract, onRequireAuth, currentUserId, targetId }: CommentNodeProps) {
  const formattedDate = comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : '';
  const userAvatar = comment.avatar || comment.user?.avatar;
  const userName = comment.displayName || comment.user?.displayName || 'Khách';
  const hasReplies = comment.childCommment && comment.childCommment.length > 0;
  
  const isEdited = comment.updatedAt && comment.updatedAt !== comment.createdAt;

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isReplying, setIsReplying] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  const [currentReaction, setCurrentReaction] = useState<'like' | 'dislike' | 'none'>(comment.userReaction || 'none');
  const [likeCount, setLikeCount] = useState<number>(comment.like || 0);
  const [dislikeCount, setDislikeCount] = useState<number>(comment.dislike || 0);

  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<'below' | 'above'>('below');

  const isTargeted = comment.id === targetId;

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeMenu = () => setIsMenuOpen(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const height = rect.height || 120;
      const spaceBelow = window.innerHeight - rect.top;
      if (spaceBelow < height && rect.top > height) {
        setMenuPosition('above');
      } else {
        setMenuPosition('below');
      }
    }
  }, [isMenuOpen]);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      try {
        await onDelete(comment.id);
      } catch (err) {
        console.error('Lỗi khi xóa bình luận:', err);
      }
    }
  };

  useEffect(() => {
    setCurrentReaction(comment.userReaction || 'none');
    setLikeCount(comment.like || 0);
    setDislikeCount(comment.dislike || 0);
  }, [comment.userReaction, comment.like, comment.dislike]);

  const handleReaction = async (reaction: 'like' | 'dislike') => {
    if (!canInteract) {
      onRequireAuth();
      return;
    }

    const nextReaction = currentReaction === reaction ? 'none' : reaction;
    try {
      await onReact(comment.id, nextReaction);
      setCurrentReaction(nextReaction);
      if (reaction === 'like') {
        setLikeCount((prev) => prev + (nextReaction === 'like' ? 1 : -1));
        if (currentReaction === 'dislike') {
          setDislikeCount((prev) => prev - 1);
        }
      } else {
        setDislikeCount((prev) => prev + (nextReaction === 'dislike' ? 1 : -1));
        if (currentReaction === 'like') {
          setLikeCount((prev) => prev - 1);
        }
      }
    } catch (err) {
      console.error('Không thể cập nhật phản ứng:', err);
    }
  };

  const isCommentContentDeleted = !comment.content || comment.content.trim() === '';
  const isOwnComment = currentUserId === (comment.user?.id || comment.userId);

  return (
    <li className={`${styles['cm-item']} ${hasReplies ? styles['cm-item--has-replies'] : ''} ${isCommentContentDeleted ? styles['cm-item--highlight'] : ''} ${isTargeted ? styles['cm-item--targeted'] : ''}`} id={`cm-${comment.id}`}>
      <div className={styles['cm-item__main']}>
        <a className={styles['cm-item__avatar']} href={`/u/${comment.user?.displayName || 'guest'}`} aria-label={userName}>
          {userAvatar ? (
            <span className={styles['uavatar'] || 'uavatar'} aria-hidden="true" style={{ width: 32, height: 32 }}>
              <img src={userAvatar} alt={userName} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            </span>
          ) : (
            <span className={styles['uavatar'] || 'uavatar'} aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: getAvatarBg(userName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
              {userName.charAt(0).toUpperCase()}
            </span>
          )}
        </a>
        <div className={styles['cm-item__detail']}>
          <div className={styles['cm-item__header']}>
            <div className={styles['cm-item__header-main']}>
              <span className={styles['cm-item__user']}>
                <a href={`/u/${comment.user?.displayName || 'guest'}`}>{userName}</a>
              </span>
              <span className={styles['cm-item__time']}>
                {formattedDate}
                {isEdited && !isCommentContentDeleted ? ' · edited' : ''}
              </span>
            </div>
            <span 
              className={styles['cm-item__collapser']} 
              role="button" 
              tabIndex={0} 
              aria-label={isCollapsed ? "Expand comment" : "Collapse comment"} 
              title={isCollapsed ? "Expand" : "Collapse"}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <i aria-hidden="true">{isCollapsed ? '+' : '−'}</i>
            </span>
          </div>

          {!isCollapsed && (
            <>
              {isEditing ? (
                <CommentFormEditor
                  placeholder="Edit your comment…"
                  initialValue={comment.content}
                  submitButtonText="Save"
                  onCancel={() => setIsEditing(false)}
                  onSubmit={async (newText) => {
                    if (onEdit) {
                      await onEdit(comment.id, newText);
                    }
                    setIsEditing(false);
                  }}
                  autoFocus
                />
              ) : (
                <div className={`${styles['cm-item__content']} ${styles['content-rendered']}`}>
                  {isCommentContentDeleted ? (
                    <em>This comment has been deleted.</em>
                  ) : (
                    parseMarkdown(comment.content)
                  )}
                </div>
              )}

              <div className={styles['cm-item__ctrls']}>
                <button type="button" className={`${styles['cm-item__ctrl']} ${styles['cm-item__ctrl--like']} ${currentReaction === 'like' ? styles['cm-item__ctrl--active'] : ''}`} aria-pressed={currentReaction === 'like'} aria-label="Like" onClick={() => handleReaction('like')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M7 10v12"></path>
                    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4-9h.5a2.5 2.5 0 0 1 2.5 2.88z"></path>
                  </svg>
                  <span>{likeCount}</span>
                </button>

                <button type="button" className={`${styles['cm-item__ctrl']} ${styles['cm-item__ctrl--dislike']} ${currentReaction === 'dislike' ? styles['cm-item__ctrl--active'] : ''}`} aria-pressed={currentReaction === 'dislike'} aria-label="Dislike" onClick={() => handleReaction('dislike')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17 14V2"></path>
                    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4 9h-.5a2.5 2.5 0 0 1-2.5-2.88z"></path>
                  </svg>
                  <span>{dislikeCount}</span>
                </button>

                <button 
                  type="button" 
                  className={`${styles['cm-item__ctrl']} ${styles['cm-item__ctrl--reply']} ${isReplying ? styles['cm-item__ctrl--active'] : ''}`} 
                  aria-expanded={isReplying ? "true" : "false"}
                  onClick={() => {
                    if (!canInteract) {
                      onRequireAuth();
                      return;
                    }
                    setIsReplying(!isReplying);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <polyline points="9 17 4 12 9 7"></polyline>
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                  </svg>
                  <span>Reply</span>
                </button>

                {/* Dropdown Menu "More" */}
                <div className={`${styles['fdrop']} ${styles['cm-item__menu']} ${isMenuOpen ? styles['is-open'] : ''}`}>
                  <button 
                    type="button" 
                    className={`${styles['cm-item__ctrl']} ${styles['cm-item__ctrl--menu']} ${isMenuOpen ? styles['cm-item__ctrl--active'] : ''}`} 
                    aria-haspopup="menu" 
                    aria-expanded={isMenuOpen ? "true" : "false"} 
                    aria-label="More actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(!isMenuOpen);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="2"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                      <circle cx="19" cy="12" r="2"></circle>
                    </svg>
                    <span>More</span>
                  </button>
                  {isMenuOpen && (
                    <div 
                      ref={menuRef}
                      className={`${styles['fdrop__pop']} ${styles['fdrop__pop--menu']}`} 
                      role="menu"
                      style={{
                        position: 'absolute',
                        right: 0,
                        zIndex: 100,
                        ...(menuPosition === 'above'
                          ? { bottom: '100%', top: 'auto', marginBottom: '4px' }
                          : { top: '100%', bottom: 'auto', marginTop: '4px' }
                        )
                      }}
                    >
                      {isOwnComment ? (
                        <>
                          {!isCommentContentDeleted && (
                            <button type="button" className={styles['fdrop__item']} role="menuitem" onClick={() => setIsEditing(true)}>
                              Edit
                            </button>
                          )}
                          <button type="button" className={styles['fdrop__item']} role="menuitem" onClick={handleDelete}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <button type="button" className={styles['fdrop__item']} role="menuitem" onClick={() => alert('Đã báo cáo bình luận.')}>
                          Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (hasReplies || isReplying) && (
        <ul className={styles['cm-item__replies']}>
          {isReplying && (
            <li className={`${styles['cm-item']} ${styles['cm-item--editor']}`}>
              <div className={styles['cm-item__main']}>
                <span className={styles['cm-item__avatar']} aria-hidden="true">
                  <span className={styles['uavatar'] || 'uavatar'} aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: 'rgb(122, 82, 56)' }}>
                    R
                  </span>
                </span>
                <div className={styles['cm-item__detail']}>
                  <CommentFormEditor
                    placeholder={`Reply to ${userName}…`}
                    submitButtonText="Reply"
                    onCancel={() => setIsReplying(false)}
                    onSubmit={async (text) => {
                      await onReplySubmit(comment.id, text);
                      setIsReplying(false);
                    }}
                    autoFocus
                  />
                </div>
              </div>
            </li>
          )}

          {hasReplies && comment.childCommment!.map((child) => (
            <CommentNode 
              key={child.id} 
              comment={child} 
              depth={depth + 1} 
              onReplySubmit={onReplySubmit} 
              onReact={onReact} 
              onDelete={onDelete} 
              onEdit={onEdit}
              canInteract={canInteract} 
              onRequireAuth={onRequireAuth} 
              currentUserId={currentUserId}
              targetId={targetId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── MAIN COMPONENT ───
interface CommentsSectionProps {
  id?: string;
  targetId?: string;
  type?: 'comic' | 'chapter';
}

export default function CommentsSection({ id, targetId, type = 'comic' }: CommentsSectionProps) {
  const [targetComment, setTargetComment] = useState<Comment | null>(null);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [sortBy, setSortBy] = useState<'best' | 'newest' | 'oldest'>('best');
  const [visibleCount, setVisibleCount] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { isLoggedIn, user } = useAuth();
  const activeId = id || '';
  const username = user?.displayName || user?.userName || 'ReaderPro';

  const fetchComments = async (currentSort: 'best' | 'newest' | 'oldest' = sortBy, reset = true, offsetValue = 0) => {
    if (!activeId) return;

    setIsLoading(true);
    try {
      const limit = 10;
      const offset = reset ? 0 : offsetValue;
      const data = type === 'comic'
        ? await comicApi.getComments(activeId, limit, offset, currentSort)
        : await chapterApi.getComments(activeId, limit, offset);

      if (data && Array.isArray(data.comments)) {
        const total = typeof (data as { total?: number }).total === 'number' ? (data as { total?: number }).total : 0;
        setCommentsList((prev) => reset ? data.comments : [...prev, ...data.comments]);
        setHasMore((data.comments?.length || 0) === limit && (total ? offset + data.comments.length < total : true));
      }
    } catch (err) {
      console.error(`Lỗi tải bình luận (${type}):`, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setVisibleCount(10);
    setHasMore(false);
    setTargetComment(null);

    const loadData = async () => {
      if (targetId) {
        try {
          const res = await commentApi.getDetail(targetId);
          if (res && res.comment) {
            setTargetComment(res.comment);
          }
        } catch (err) {
          console.warn('Không tải được comment cụ thể (targetId):', err);
        }
      }
      await fetchComments(sortBy, true, 0);
    };

    void loadData();
  }, [activeId, type, sortBy, targetId]);

  useLayoutEffect(() => {
    if (targetId && targetComment) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`cm-${targetId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [targetId, targetComment]);

  const handleCommentSubmitLocal = async (text: string) => {
    if (!activeId) return;
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      if (type === 'comic') {
        await comicApi.createComment(activeId, text);
      } else {
        await chapterApi.createComment(activeId, text);
      }
      await fetchComments(sortBy, true, 0);
    } catch (err) {
      console.error('Không thể gửi bình luận:', err);
    }
  };

  const handleReplySubmit = async (parentId: string, text: string) => {
    if (!activeId || !isLoggedIn) {
      throw new Error('Please log in to reply.');
    }
    try {
      if (type === 'comic') {
        await comicApi.createComment(activeId, text, parentId);
      } else {
        await chapterApi.createComment(activeId, text, parentId);
      }
      await fetchComments(sortBy, true, 0);
    } catch (err) {
      console.error('Không thể gửi phản hồi:', err);
      throw err;
    }
  };

  const handleEditSubmit = async (commentId: string, text: string) => {
    try {
      if (type === 'comic') {
        await comicApi.editComment(commentId, text);
      } else {
        await chapterApi.editComment(commentId, text);
      }
      await fetchComments(sortBy, true, 0);
    } catch (err) {
      console.error('Không thể sửa đổi bình luận:', err);
      throw err;
    }
  };

  const handleReaction = async (commentId: string, reaction: 'like' | 'dislike' | 'none') => {
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      throw new Error('Please log in to react.');
    }
    if (type === 'comic') {
      await comicApi.reactComment(commentId, reaction);
    } else {
      await chapterApi.reactComment(commentId, reaction);
    }
    await fetchComments(sortBy, true, 0);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (type === 'comic') {
      await comicApi.deleteComment(commentId);
    } else {
      await chapterApi.deleteComment(commentId);
    }
    await fetchComments(sortBy, true, 0);
  };

  const handleLoadMore = async () => {
    if (isLoading || !hasMore) return;
    const nextOffset = visibleCount;
    setVisibleCount(nextOffset + 10);
    await fetchComments(sortBy, false, nextOffset);
  };

  const filteredSortedComments = useMemo(() => {
    let list = [...commentsList];
    
    if (targetComment) {
      list = list.filter(c => c.id !== targetComment.id);
    }

    if (sortBy === 'newest') {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (sortBy === 'oldest') {
      return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return list.sort((a, b) => (b.like - b.dislike) - (a.like - a.dislike));
  }, [commentsList, sortBy, targetComment]);

  return (
    <section className={`${styles['cm-widget']} ${styles['mpage__sec']}`}>
      <header className={styles['cm-widget__head']}>
        <div className={styles['cm-widget__title-row']}>
          <div className={styles['cm-widget__title']}>
            {(commentsList.length + (targetComment ? 1 : 0))} comments
          </div>
        </div>
        <div className={`${styles['useg']} ${styles['cm-widget__sort']}`}>
          <button
            type="button"
            className={`${styles['useg__btn']} ${sortBy === 'best' ? styles['is-on'] : ''}`}
            onClick={() => setSortBy('best')}
          >
            Best
          </button>
          <button
            type="button"
            className={`${styles['useg__btn']} ${sortBy === 'newest' ? styles['is-on'] : ''}`}
            onClick={() => setSortBy('newest')}
          >
            Newest
          </button>
          <button
            type="button"
            className={`${styles['useg__btn']} ${sortBy === 'oldest' ? styles['is-on'] : ''}`}
            onClick={() => setSortBy('oldest')}
          >
            Oldest
          </button>
        </div>
      </header>

      <div className={`${styles['cm-item']} ${styles['cm-item--editor']}`}>
        <div className={styles['cm-item__main']}>
          <span className={styles['cm-item__avatar']} aria-hidden="true">
            <span className={styles['uavatar'] || 'uavatar'} aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: 'rgb(122, 82, 56)' }}>
              {username.charAt(0).toUpperCase()}
            </span>
          </span>
          {isLoggedIn ? (
            <div className={styles['cm-item__detail']}>
              <CommentFormEditor
                placeholder="Share your thoughts about this series…"
                submitButtonText="Send"
                onSubmit={handleCommentSubmitLocal}
              />
            </div>
          ) : (
            <div className={styles['cm-item__detail']} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' }}>
              <p style={{ margin: 0, opacity: 0.8 }}>Please sign in to join the discussion.</p>
              <button type="button" className={`${styles['ubtn']} ${styles['ubtn--primary']}`} style={{ width: 'fit-content' }} onClick={() => setIsAuthModalOpen(true)}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>

      <ul className={styles['cm-items']}>
        {/* 1. RENDER COMMENT MỤC TIÊU TRƯỚC (NẾU CÓ) */}
        {targetComment && (
          <CommentNode 
            key={targetComment.id} 
            comment={targetComment} 
            depth={0} 
            onReplySubmit={handleReplySubmit} 
            onReact={handleReaction} 
            onDelete={handleDeleteComment} 
            onEdit={handleEditSubmit}
            canInteract={isLoggedIn} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            currentUserId={user?.id}
            targetId={targetId}
          />
        )}

        {/* 2. RENDER CÁC COMMENT CÒN LẠI KHÔNG TRÙNG LẶP */}
        {filteredSortedComments.map((comment) => (
          <CommentNode 
            key={comment.id} 
            comment={comment} 
            depth={0} 
            onReplySubmit={handleReplySubmit} 
            onReact={handleReaction} 
            onDelete={handleDeleteComment} 
            onEdit={handleEditSubmit}
            canInteract={isLoggedIn} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            currentUserId={user?.id}
            targetId={targetId}
          />
        ))}

        {filteredSortedComments.length === 0 && !targetComment && (
          <li className={styles['cm-item']} style={{ padding: '24px', textAlign: 'center', opacity: 0.7 }}>
            No comments yet. Start the conversation!
          </li>
        )}
      </ul>

      {hasMore && (
        <div className={styles['cm-foot']}>
          <button type="button" className={`${styles['ubtn']} ${styles['ubtn--soft']} ${styles['cm-foot__btn']}`} onClick={handleLoadMore} disabled={isLoading}>
            <span>{isLoading ? 'Loading…' : 'Load more comments'}</span>
          </button>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </section>
  );
}