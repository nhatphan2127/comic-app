// Emoji images bundled from src/assets/emojis/<Category>/<codepoints>.webp
const emojiGlob = import.meta.glob('/src/assets/emojis/**/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export interface EmojiItem {
  code: string;
  name: string;
  url: string;
}

export interface EmojiCategory {
  name: string;
  icon: string;
  items: EmojiItem[];
}

const CATEGORY_ICONS: Record<string, string> = {
  'Smileys & Emotion': '😀',
  'Gestures & Body': '👋',
  'People & Fantasy': '🦸',
  'Animals & Nature': '🐶',
  'Food & Drink': '🍔',
  'Travel & Places': '✈️',
  'Objects & Tools': '💡',
  'Symbols & Flags': '🏁',
};

/** Custom (non-unicode) emojis and their :shortcode: */
const SHORTCODES: Record<string, string> = {
  PACMAN: 'pacman',
  LIKE: 'like',
  FACE_WITH_COLON_THREE: 'colonthree',
};
const SHORTCODE_TO_CODE = Object.fromEntries(Object.entries(SHORTCODES).map(([code, short]) => [short, code]));

const normalize = (code: string) => code.toLowerCase().replace('_fe0f', '');

const byCategory = new Map<string, EmojiItem[]>();
const urlByCode = new Map<string, string>();

for (const [path, url] of Object.entries(emojiGlob)) {
  const match = path.match(/\/emojis\/([^/]+)\/(.+)\.webp$/);
  if (!match) continue;
  const [, folder, code] = match;
  const category = folder.replace('___', ' & ');
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category)!.push({ code, name: code.toUpperCase(), url });
  urlByCode.set(normalize(code), url);
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [...byCategory.entries()].map(([name, items]) => ({
  name,
  icon: CATEGORY_ICONS[name] ?? '🌟',
  items,
}));

/** "1f600" -> "😀"; custom emojis become ":shortcode:" */
export function codeToText(code: string): string {
  if (SHORTCODES[code]) return `:${SHORTCODES[code]}:`;
  try {
    return code
      .split('_')
      .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
      .join('');
  } catch {
    return `:${code}:`;
  }
}

/** "😀" -> "1f600" */
export function charToCode(char: string): string {
  return Array.from(char)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((hex) => hex !== 'fe0f')
    .join('_');
}

/** Resolves an emoji char, ":shortcode:" or raw code to a bundled image URL ('' if none). */
export function getEmojiUrl(token: string): string {
  let code = token;
  if (token.length > 2 && token.startsWith(':') && token.endsWith(':')) {
    const short = token.slice(1, -1);
    code = SHORTCODE_TO_CODE[short] ?? short;
  } else if (token && !/[a-zA-Z0-9_]/.test(token[0])) {
    code = charToCode(token);
  }
  return urlByCode.get(normalize(code)) ?? '';
}

/** Remote fallback when a bundled image fails to load. */
export function emojiFallback(e: React.SyntheticEvent<HTMLImageElement>, code: string) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = `https://emoji.fbicons.net/fb24/${code}.webp`;
}
