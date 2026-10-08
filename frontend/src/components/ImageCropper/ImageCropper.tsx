import { useRef, useState, type PointerEvent } from 'react';
import { ZoomIn } from 'lucide-react';
import Modal from '../Modal/Modal';
import styles from './ImageCropper.module.css';

interface ImageCropperProps {
  imageSrc: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  /** Output size in px (square). */
  outputSize?: number;
}

/** Square crop with drag-to-pan and zoom; returns a JPEG data URL. */
export default function ImageCropper({ imageSrc, onClose, onSave, outputSize = 256 }: ImageCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragFrom.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragFrom.current) return;
    setOffset({ x: e.clientX - dragFrom.current.x, y: e.clientY - dragFrom.current.y });
  };

  const endDrag = () => {
    dragFrom.current = null;
  };

  const save = () => {
    const img = imageRef.current;
    const frame = frameRef.current;
    if (!img || !frame) return;

    const imgRect = img.getBoundingClientRect();
    const cropRect = frame.getBoundingClientRect();
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      (cropRect.left - imgRect.left) * scaleX,
      (cropRect.top - imgRect.top) * scaleY,
      cropRect.width * scaleX,
      cropRect.height * scaleY,
      0,
      0,
      outputSize,
      outputSize,
    );
    onSave(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title="Crop your avatar"
      subtitle="Drag to reposition, use the slider to zoom."
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Use this photo
          </button>
        </>
      }
    >
      <div
        className={styles.workspace}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt=""
          draggable={false}
          className={styles.image}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        />
        <div ref={frameRef} className={styles.frame} />
      </div>

      <label className={styles.zoom}>
        <ZoomIn size={16} />
        <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
      </label>
    </Modal>
  );
}
