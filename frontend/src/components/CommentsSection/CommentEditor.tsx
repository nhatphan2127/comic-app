import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Bold, Eye, EyeOff, Image, Italic, Quote, Smile, Film } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { EmojiPicker, GifPicker } from './Pickers';
import { renderMarkdown } from './markdown';
import cx from '../../helpers/cx';
import styles from './CommentsSection.module.css';

interface CommentEditorProps {
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
}

type Popup = 'emoji' | 'gif' | null;

const SHORTCUTS: Record<string, [string, string]> = {
  b: ['**', '**'],
  i: ['*', '*'],
  e: ['||', '||'],
};

export default function CommentEditor({
  placeholder,
  submitLabel,
  initialValue = '',
  autoFocus = false,
  onSubmit,
  onCancel,
}: CommentEditorProps) {
  const [text, setText] = useState(initialValue);
  const [isPreview, setIsPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  /** Wraps the current selection with before/after, or inserts at the caret. */
  const insert = (before: string, after = '') => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + before + after);
      return;
    }
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    setText(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const shortcut = e.ctrlKey || e.metaKey ? SHORTCUTS[e.key.toLowerCase()] : undefined;
    if (shortcut) {
      e.preventDefault();
      insert(...shortcut);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSubmit(text);
      setText('');
      setIsPreview(false);
    } catch (err) {
      // The text stays in the box so nothing typed is lost.
      toast.error(err, 'Could not post your comment.');
    } finally {
      setIsSending(false);
    }
  };

  const togglePopup = (next: Popup) => setPopup((cur) => (cur === next ? null : next));

  const tool = (label: string, icon: ReactNode, onClick: () => void, active = false) => (
    <button
      type="button"
      className={cx(styles.tool, active && styles.toolOn)}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={isPreview}
      // Keep the picker's click-outside handler from closing it just before this toggles it.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      {isPreview ? (
        <div className={cx(styles.editorInput, styles.preview, styles.content)}>
          {text.trim() ? renderMarkdown(text) : <span className={styles.muted}>Nothing to preview…</span>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={styles.editorInput}
          placeholder={placeholder}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />
      )}

      <div className={styles.editorBar}>
        <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
          {tool('Bold (Ctrl+B)', <Bold size={15} />, () => insert('**', '**'))}
          {tool('Italic (Ctrl+I)', <Italic size={15} />, () => insert('*', '*'))}
          {tool('Quote', <Quote size={15} />, () => insert('> '))}
          {tool('Spoiler (Ctrl+E)', <EyeOff size={15} />, () => insert('||', '||'))}
          {tool('Image', <Image size={15} />, () => {
            const url = window.prompt('Image URL:');
            if (url) insert(`![Image](${url})`);
          })}
          <span className={styles.toolWrap}>
            {tool('Emoji', <Smile size={15} />, () => togglePopup('emoji'), popup === 'emoji')}
            {popup === 'emoji' ? <EmojiPicker onClose={() => setPopup(null)} onSelect={(emoji) => insert(emoji)} /> : null}
          </span>
          <span className={styles.toolWrap}>
            {tool('GIF', <Film size={15} />, () => togglePopup('gif'), popup === 'gif')}
            {popup === 'gif' ? (
              <GifPicker onClose={() => setPopup(null)} onSelect={(url, title) => insert(`![${title}](${url})`)} />
            ) : null}
          </span>
          <span className={styles.toolDivider} />
          <button
            type="button"
            className={cx(styles.tool, isPreview && styles.toolOn)}
            aria-label="Preview"
            title="Preview"
            aria-pressed={isPreview}
            onClick={() => setIsPreview((v) => !v)}
          >
            <Eye size={15} />
          </button>
        </div>

        <div className={styles.editorActions}>
          {onCancel ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={isSending}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="btn btn--primary btn--sm" disabled={!text.trim() || isSending}>
            {isSending ? 'Sending…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
