import { useState, type ReactNode } from 'react';
import { charToCode, emojiFallback, getEmojiUrl } from './emoji';
import cx from '../../helpers/cx';
import styles from './CommentsSection.module.css';

// **bold** | *italic* | ||spoiler|| | ![alt](url) | emoji (surrogate pair / BMP symbol) | :shortcode:
const INLINE_TOKEN =
  /(\*\*.*?\*\*|\*.*?\*|\|\|.*?\|\||!\[.*?\]\(.*?\)|[\uD800-\uDBFF][\uDC00-\uDFFF][‍️]*|[☀-➿][️]*|:[a-zA-Z0-9_]+:)/g;

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      className={cx(styles.spoiler, revealed && styles.spoilerOpen)}
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((v) => !v);
      }}
      onKeyDown={(e) => e.key === 'Enter' && setRevealed((v) => !v)}
    >
      {children}
    </span>
  );
}

function renderToken(part: string, key: number): ReactNode {
  if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
  if (part.length > 4 && part.startsWith('||') && part.endsWith('||')) return <Spoiler key={key}>{part.slice(2, -2)}</Spoiler>;
  if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;

  const image = part.match(/^!\[(.*?)\]\((.*?)\)$/);
  if (image) return <img key={key} src={image[2]} alt={image[1]} className={styles.inlineImg} loading="lazy" />;

  const emojiUrl = getEmojiUrl(part);
  if (emojiUrl) {
    const code = part.startsWith(':') ? part.slice(1, -1) : charToCode(part);
    return (
      <img key={key} src={emojiUrl} alt={part} className={styles.inlineEmoji} onError={(e) => emojiFallback(e, code)} />
    );
  }

  return part;
}

/** Renders the small markdown subset supported in comments. */
export function renderMarkdown(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => {
    const isQuote = line.startsWith('> ');
    const content = (isQuote ? line.slice(2) : line).split(INLINE_TOKEN).map(renderToken);
    return isQuote ? (
      <blockquote key={i} className={styles.quote}>
        {content}
      </blockquote>
    ) : (
      <p key={i} className={styles.line}>
        {content}
      </p>
    );
  });
}
