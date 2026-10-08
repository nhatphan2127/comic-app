import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ChapterDetail, ComicDetail } from '../../types/types';
import { resolveUploadUrl } from '../../helpers/getImage';
import Modal from '../Modal/Modal';
import ComicForm from '../ComicForm/ComicForm';
import { comicToForm } from '../ComicForm/comicFormValues';
import styles from './SubmissionPreview.module.css';

interface PreviewProps<T> {
  isOpen: boolean;
  loading?: boolean;
  data: T | null;
  onClose: () => void;
}

/** Read-only view of a submitted comic. */
export function ComicPreviewModal({ isOpen, loading, data, onClose }: PreviewProps<ComicDetail>) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={data?.name || 'Comic preview'}>
      {loading || !data ? <div className="empty-state">Loading…</div> : <ComicForm values={comicToForm(data)} readOnly />}
    </Modal>
  );
}

/** Page-by-page viewer for a submitted chapter. */
export function ChapterPreviewModal({ isOpen, loading, data, onClose }: PreviewProps<ChapterDetail>) {
  const [index, setIndex] = useState(0);
  const images = [...(data?.images ?? [])].sort((a, b) => a.pageNumber - b.pageNumber);
  const total = images.length;

  useEffect(() => setIndex(0), [data?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, total]);

  const title = data ? `Chapter ${data.chapterNumber}${data.title ? ` · ${data.title}` : ''}` : 'Chapter preview';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={title} subtitle={total ? `Page ${index + 1} of ${total}` : undefined}>
      {loading || !data ? (
        <div className="empty-state">Loading…</div>
      ) : total === 0 ? (
        <div className="empty-state">This chapter has no pages.</div>
      ) : (
        <div className={styles.viewer}>
          <img src={resolveUploadUrl(images[index].urlPath) ?? ''} alt={`Page ${index + 1}`} />
          <button
            type="button"
            className={styles.navPrev}
            aria-label="Previous page"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className={styles.navNext}
            aria-label="Next page"
            disabled={index === total - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </Modal>
  );
}
