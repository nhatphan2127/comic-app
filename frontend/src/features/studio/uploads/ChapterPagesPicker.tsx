import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { GripVertical, ImagePlus, Minus, Plus, X } from 'lucide-react';
import { parsePageNumber } from '../../../helpers/utils';
import Modal from '../../../components/Modal/Modal';
import cx from '../../../helpers/cx';
import style from './Uploads.module.css';

export interface ChapterPage {
  id: string;
  file: File;
  previewUrl: string;
}

interface Props {
  pages: ChapterPage[];
  onChange: (pages: ChapterPage[]) => void;
  onError: (message: string | null) => void;
}

const toPage = (file: File): ChapterPage => ({
  id: `${file.name}-${crypto.randomUUID()}`,
  file,
  previewUrl: URL.createObjectURL(file),
});

/**
 * Checks that every filename carries a page number and that the numbers are consecutive.
 * Returns the files sorted by that number plus an optional warning.
 */
function sortByFilename(files: File[]): { sorted: File[]; warning: string | null } {
  const numbered = files.map((file) => ({ file, n: parsePageNumber(file.name) }));
  if (numbered.some((x) => Number.isNaN(x.n))) {
    return { sorted: files, warning: 'Some filenames have no page number — check the order below before uploading.' };
  }
  numbered.sort((a, b) => a.n - b.n);
  const gap = numbered.some((x, i) => x.n !== numbered[0].n + i);
  return {
    sorted: numbered.map((x) => x.file),
    warning: gap ? 'Page numbers are not consecutive — some pages may be missing.' : null,
  };
}

/** Image picker with drag-to-reorder and full-size preview. Upload order = page order. */
export default function ChapterPagesPicker({ pages, onChange, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reorder, setReorder] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [preview, setPreview] = useState<ChapterPage | null>(null);
  const [zoom, setZoom] = useState(1);

  // Revoke every preview URL still alive when the picker unmounts.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    if (files.some((f) => f.name.toLowerCase().endsWith('.zip'))) {
      onError('ZIP archives are not supported yet — please select the page images instead.');
      return;
    }
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      onError('Please select image files.');
      return;
    }

    const { sorted, warning } = sortByFilename(images);
    pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    onChange(sorted.map(toPage));
    onError(warning);
  };

  const remove = (index: number) => {
    URL.revokeObjectURL(pages[index].previewUrl);
    onChange(pages.filter((_, i) => i !== index));
  };

  const drop = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragFrom !== null && dragFrom !== index) {
      const next = [...pages];
      const [moved] = next.splice(dragFrom, 1);
      next.splice(index, 0, moved);
      onChange(next);
    }
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div className={style.pages}>
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={pickFiles} />

      <div className={style.pagesBar}>
        <button type="button" className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={16} />
          {pages.length ? 'Replace pages' : 'Choose pages'}
        </button>
        {pages.length ? <span className={style.muted}>{pages.length} pages</span> : null}
        {pages.length > 1 ? (
          <label className={style.reorderToggle}>
            <input type="checkbox" checked={reorder} onChange={(e) => setReorder(e.target.checked)} />
            Drag to reorder
          </label>
        ) : null}
      </div>

      {pages.length === 0 ? (
        <button type="button" className={style.dropzone} onClick={() => inputRef.current?.click()}>
          <ImagePlus size={28} />
          <strong>Select page images</strong>
          <span>Name files with their page number (01.jpg, 02.jpg …) and they will be ordered automatically.</span>
        </button>
      ) : (
        <ul className={style.thumbs}>
          {pages.map((page, i) => (
            <li
              key={page.id}
              className={cx(style.thumb, reorder && style.thumbDraggable, dragFrom === i && style.thumbDragging, dragOver === i && style.thumbOver)}
              draggable={reorder}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!reorder) return;
                e.preventDefault();
                if (dragOver !== i) setDragOver(i);
              }}
              onDrop={(e) => reorder && drop(e, i)}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
            >
              <button
                type="button"
                className={style.thumbImg}
                onClick={() => {
                  if (reorder) return;
                  setZoom(1);
                  setPreview(page);
                }}
              >
                <img src={page.previewUrl} alt={page.file.name} />
                {reorder ? (
                  <span className={style.grip}>
                    <GripVertical size={14} />
                  </span>
                ) : null}
              </button>
              <span className={style.thumbNum}>{i + 1}</span>
              <button type="button" className={style.thumbRemove} aria-label={`Remove ${page.file.name}`} onClick={() => remove(i)}>
                <X size={12} />
              </button>
              <span className={style.thumbName} title={page.file.name}>
                {page.file.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        size="lg"
        title={preview?.file.name}
        footer={
          <>
            <button type="button" className="btn btn--ghost btn--icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <Minus size={16} />
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className="btn btn--ghost btn--icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <Plus size={16} />
            </button>
          </>
        }
      >
        {preview ? (
          <div className={style.previewStage}>
            <img src={preview.previewUrl} alt="" style={{ transform: `scale(${zoom})` }} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
