import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import cx from '../../helpers/cx';
import style from './CodeBlock.module.css';

interface CodeBlockProps {
  code: string;
  /** Shown in the header, e.g. "bash" or "python". */
  label?: string;
  className?: string;
}

/** Monospace block with a copy button. */
export default function CodeBlock({ code, label, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (http, permissions): the text is still selectable.
    }
  };

  return (
    <div className={cx(style.block, className)}>
      <div className={style.head}>
        <span>{label}</span>
        <button type="button" className={style.copy} onClick={() => void copy()} aria-label="Copy to clipboard">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={cx(style.pre, 'mono')}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
