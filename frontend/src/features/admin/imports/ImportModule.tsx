import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  CloudUpload,
  FileArchive,
  HardDrive,
  Images,
  Layers,
  LoaderCircle,
  X,
} from 'lucide-react';
import { ApiError, adminApi, type AdminImportResult } from '../../../services/api';
import Page, { Card, Notice } from '../../../console/ui/Page';
import CodeBlock from '../../../console/ui/CodeBlock';
import cx from '../../../helpers/cx';
import { IMPORT_LIMITS, inspectZip, uploadZipFiles, type PreparedZip } from './zipImport';
import style from './Import.module.css';

type Phase = 'idle' | 'scanning' | 'uploading' | 'committing' | 'complete';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'scanning', label: 'Scan ZIP' },
  { phase: 'uploading', label: 'Upload images' },
  { phase: 'committing', label: 'Create records' },
];

type QueueStatus = 'queued' | 'active' | 'done' | 'failed';

const QUEUE_LABELS: Record<QueueStatus, string> = {
  queued: 'Queued',
  active: 'Uploading',
  done: 'Uploaded',
  failed: 'Failed',
};

// Example layout shown in the "How to prepare the ZIP" guide; the rules are in zipImport.ts and
// adminImportValidation.js.
const STRUCTURE_EXAMPLE = `my-comics.zip
├── Moonlit Blade/                 comic folder
│   ├── comic.json                 comic details
│   ├── cover.jpg                  cover image
│   ├── Chapter 1/                 chapter 1
│   │   ├── 001.jpg                pages, in file-name order
│   │   └── 002.jpg
│   └── Chapter 2.5 - The Duel/    chapter 2.5, titled "The Duel"
└── Another Comic/
    └── …`;

const FIELDS: { name: string; required?: boolean; body: string }[] = [
  { name: 'name', required: true, body: 'Title, up to 200 characters.' },
  { name: 'type', required: true, body: 'manga, manhwa, manhua or other.' },
  { name: 'url', body: 'Lowercase slug (a-z, 0-9, -). Made from the name when missing; must not be taken.' },
  { name: 'contentRating', body: 'safe (default), suggestive, erotica or pornographic.' },
  { name: 'releaseStatus', body: 'releasing (default), finished, on hiatus or discontinued. "ongoing" and "completed" also work.' },
  { name: 'releasingYear', body: 'Four-digit year.' },
  { name: 'author, artist', body: 'Names, up to 100 characters each.' },
  { name: 'description, source', body: 'Free text.' },
  { name: 'genres, formats', body: 'A list or a comma-separated string. Unknown tags are skipped with a warning.' },
];

const COMIC_JSON_EXAMPLE = `{
  "name": "Moonlit Blade",
  "type": "manhwa",
  "contentRating": "safe",
  "releaseStatus": "releasing",
  "releasingYear": 2024,
  "author": "Han Seol",
  "artist": "Han Seol",
  "description": "A swordswoman hunts the moon thief.",
  "genres": ["Action", "Fantasy"],
  "formats": ["Long Strip", "Full Color"]
}`;

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10 * 1024 ? 0 : 1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ImportModule() {
  const [file, setFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<PreparedZip | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanBytes, setScanBytes] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  // Per-comic upload progress for the queue: images uploaded so far, the comic being uploaded now,
  // and the comic whose upload failed (if any).
  const [comicUploaded, setComicUploaded] = useState<Record<string, number>>({});
  const [activeComic, setActiveComic] = useState<string | null>(null);
  const [failedComic, setFailedComic] = useState<string | null>(null);
  // Review mode for this import; starts from the site's auto-accept setting.
  const [autoApprove, setAutoApprove] = useState(false);
  const autoApproveTouched = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const importId = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeComicRef = useRef<string | null>(null);
  const queueRef = useRef<HTMLOListElement | null>(null);

  const busy = phase === 'scanning' || phase === 'uploading' || phase === 'committing';

  const queue = useMemo(() => {
    if (!prepared) return [];
    const totals = new Map<string, number>();
    for (const upload of prepared.files) totals.set(upload.comicKey, (totals.get(upload.comicKey) ?? 0) + 1);
    return prepared.manifest.comics.map((comic) => {
      const { name, url } = comic.data;
      return {
        key: comic.key,
        name: typeof name === 'string' && name.trim() ? name : typeof url === 'string' ? url : comic.key,
        chapters: comic.chapters.length,
        total: totals.get(comic.key) ?? 0,
      };
    });
  }, [prepared]);

  const queueStatus = (key: string, uploaded: number, total: number): QueueStatus => {
    if (uploaded >= total) return 'done';
    if (key === failedComic) return 'failed';
    if (key === activeComic) return 'active';
    return 'queued';
  };

  // Keep the comic being uploaded visible inside the scrolling queue (without scrolling the page).
  useEffect(() => {
    const list = queueRef.current;
    if (!list || !activeComic) return;
    const item = list.querySelector<HTMLElement>(`[data-key="${activeComic}"]`);
    if (!item) return;
    const top = item.offsetTop;
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 2 + item.offsetHeight / 2, behavior: 'smooth' });
    }
  }, [activeComic]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getSettings()
      .then((settings) => {
        if (!cancelled && !autoApproveTouched.current) setAutoApprove(settings.autoAccept);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const changeAutoApprove = (next: boolean) => {
    autoApproveTouched.current = true;
    setAutoApprove(next);
  };

  const resetQueue = () => {
    setComicUploaded({});
    setActiveComic(null);
    setFailedComic(null);
    activeComicRef.current = null;
  };

  const chooseFile = (next: File | null) => {
    if (busy) return;
    setFile(next);
    setPrepared(null);
    setResult(null);
    setError(null);
    setScanBytes(0);
    setUploadedFiles(0);
    setTotalFiles(0);
    resetQueue();
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) chooseFile(dropped);
  };

  const removeSession = async () => {
    const id = importId.current;
    if (!id) return;
    try {
      await adminApi.abortImport(id);
    } catch (cleanupError) {
      if (!(cleanupError instanceof ApiError && cleanupError.status === 404)) {
        throw cleanupError;
      }
    } finally {
      importId.current = null;
    }
  };

  const cancel = () => controller.current?.abort();

  const start = async () => {
    if (!file) return;
    setError(null);
    setResult(null);
    setPrepared(null);
    setPhase('scanning');
    setScanBytes(0);
    setUploadedFiles(0);
    resetQueue();
    const abortController = new AbortController();
    controller.current = abortController;

    try {
      const archive = await inspectZip(file, setScanBytes, abortController.signal);
      setPrepared(archive);
      setTotalFiles(archive.files.length);

      const session = await adminApi.beginImport(archive.manifest);
      importId.current = session.id;
      if (abortController.signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
      setPhase('uploading');
      await uploadZipFiles(
        file,
        archive,
        async (target, uploadFile) => {
          if (activeComicRef.current !== target.comicKey) {
            activeComicRef.current = target.comicKey;
            setActiveComic(target.comicKey);
          }
          await adminApi.uploadImportFile(session.id, target.id, uploadFile, abortController.signal);
          setComicUploaded((counts) => ({ ...counts, [target.comicKey]: (counts[target.comicKey] ?? 0) + 1 }));
        },
        setUploadedFiles,
        abortController.signal,
      );

      activeComicRef.current = null;
      setActiveComic(null);
      if (abortController.signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
      const staged = await adminApi.getImportStatus(session.id, abortController.signal);
      if (staged.status !== 'receiving' || staged.uploadedItems !== archive.files.length) {
        throw new Error('The server has not received every image; nothing was committed');
      }

      setPhase('committing');
      let committed: AdminImportResult;
      try {
        committed = await adminApi.commitImport(session.id, { autoApprove });
      } catch (commitError) {
        const status = await adminApi.getImportStatus(session.id).catch(() => null);
        if (status?.status !== 'complete') throw commitError;
        committed = status.result;
      }
      importId.current = null;
      setResult(committed);
      setPhase('complete');
    } catch (uploadError) {
      const aborted = uploadError instanceof DOMException && uploadError.name === 'AbortError';
      let message = aborted ? 'Import cancelled. Nothing was saved.' : uploadError instanceof Error ? uploadError.message : 'ZIP import failed';
      if (!aborted) setFailedComic(activeComicRef.current);
      activeComicRef.current = null;
      setActiveComic(null);
      if (importId.current) {
        try {
          await removeSession();
        } catch (cleanupError) {
          message += ` Cleanup did not finish: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}. The server will retry cleanup.`;
        }
      }
      setError(message);
      setPhase('idle');
    } finally {
      controller.current = null;
    }
  };

  const progress =
    phase === 'committing' || phase === 'complete'
      ? 100
      : phase === 'scanning' && file
        ? Math.min(100, Math.round((scanBytes / file.size) * 100))
        : totalFiles
          ? Math.min(100, Math.round((uploadedFiles / totalFiles) * 100))
          : 0;

  const stepIndex = STEPS.findIndex((step) => step.phase === phase);
  const activeStep = phase === 'complete' ? STEPS.length : stepIndex;
  const activeName = queue.find((item) => item.key === activeComic)?.name;
  const comicsUploaded = queue.filter((item) => (comicUploaded[item.key] ?? 0) >= item.total).length;
  const progressText =
    phase === 'scanning' && file
      ? `${formatBytes(scanBytes)} of ${formatBytes(file.size)} read`
      : phase === 'uploading'
        ? `${activeName ? `“${activeName}” · ` : ''}${uploadedFiles.toLocaleString()} of ${totalFiles.toLocaleString()} images uploaded`
        : phase === 'committing'
          ? 'Creating comics and chapters…'
          : phase === 'complete'
            ? `Done: ${result?.summary.comics ?? 0} comics ${autoApprove ? 'published' : 'sent for review'}`
            : file
              ? 'Ready to import'
              : 'Choose a ZIP to start';

  return (
    <Page
      title="ZIP import"
      description="Restore comics from a Studio folder backup. The ZIP is read in your browser; only the images are sent to the server, and nothing is saved unless the whole import succeeds."
    >
      <div className={style.top}>
        <Card className={style.uploadCard} title="Backup ZIP">
          <input
            ref={inputRef}
            className={style.hiddenInput}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={busy}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />

          {file ? (
            <div className={style.fileRow}>
              <span className={style.fileIcon}>
                <FileArchive size={22} />
              </span>
              <span className={style.fileText}>
                <strong title={file.name}>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
              </span>
              {!busy ? (
                <span className={style.fileActions}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => inputRef.current?.click()}>
                    Change
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm btn--icon" aria-label="Remove file" onClick={() => chooseFile(null)}>
                    <X size={15} />
                  </button>
                </span>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              className={cx(style.dropzone, dragging && style.dropzoneActive)}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className={style.dropIcon}>
                <CloudUpload size={26} />
              </span>
              <strong>Drop a .zip here or click to choose</strong>
              <span>Up to {formatBytes(IMPORT_LIMITS.zipBytes)}</span>
            </button>
          )}

          <div className={style.progressBox}>
            <ol className={style.steps}>
              {STEPS.map((step, index) => (
                <li
                  key={step.phase}
                  className={cx(style.step, index < activeStep && style.stepDone, index === activeStep && style.stepActive)}
                >
                  <span className={style.stepDot}>{index < activeStep ? <Check size={12} /> : index + 1}</span>
                  {step.label}
                </li>
              ))}
            </ol>
            <div className={style.bar} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span className={cx(style.barFill, phase === 'committing' && style.barPulse)} style={{ width: `${progress}%` }} />
            </div>
            <div className={style.progressMeta}>
              <span>{progressText}</span>
              <span className="mono">{progress}%</span>
            </div>
          </div>

          <label
            className={cx(style.toggle, busy && style.toggleDisabled)}
            title={autoApprove ? 'Comics and chapters go live as soon as the import finishes' : 'Comics and chapters wait in the review queue'}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={autoApprove}
              disabled={busy}
              onChange={(event) => changeAutoApprove(event.target.checked)}
            />
            <span className={cx(style.toggleSwitch, autoApprove && style.toggleOn)} aria-hidden="true" />
            Auto-approve
            <small>{autoApprove ? 'publish now' : 'review queue'}</small>
          </label>

          {error ? <Notice tone="err">{error}</Notice> : null}

          <div className={style.actions}>
            {busy ? (
              phase !== 'committing' ? (
                <button type="button" className="btn btn--ghost" onClick={cancel}>
                  <X size={15} />
                  Cancel import
                </button>
              ) : null
            ) : phase === 'complete' ? (
              <button type="button" className="btn btn--ghost" onClick={() => chooseFile(null)}>
                Import another ZIP
              </button>
            ) : (
              <button type="button" className="btn btn--primary" disabled={!file} onClick={() => void start()}>
                <CloudUpload size={15} />
                {error ? 'Try again' : 'Validate and import'}
              </button>
            )}
          </div>
        </Card>

        <Card
          className={style.queueCard}
          title="Import queue"
          actions={
            <span className={style.queueCount}>
              {queue.length ? `${comicsUploaded} of ${queue.length} comics uploaded` : 'Empty'}
            </span>
          }
        >
          {prepared ? (
            <ul className={style.summary} aria-label="ZIP contents">
              {[
                { label: 'comics', value: prepared.stats.comics.toLocaleString(), icon: BookOpen },
                { label: 'chapters', value: prepared.stats.chapters.toLocaleString(), icon: Layers },
                { label: 'images', value: prepared.stats.files.toLocaleString(), icon: Images },
                { label: '', value: formatBytes(prepared.stats.bytes), icon: HardDrive },
              ].map(({ label, value, icon: Icon }) => (
                <li key={label || 'bytes'}>
                  <Icon size={13} aria-hidden="true" />
                  <strong className="mono">{value}</strong>
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {queue.length ? null : (
            <div className={style.queueEmpty}>
              {phase === 'scanning' ? (
                <>
                  <LoaderCircle size={18} className={style.spin} aria-hidden="true" />
                  Reading the ZIP…
                </>
              ) : (
                <>
                  <Layers size={18} aria-hidden="true" />
                  Comics in the ZIP will be listed here once it has been scanned.
                </>
              )}
            </div>
          )}
          <ol ref={queueRef} className={style.queue} aria-label="Comics in this import" hidden={!queue.length}>
            {queue.map((item, index) => {
              const uploaded = comicUploaded[item.key] ?? 0;
              const status = queueStatus(item.key, uploaded, item.total);
              const percent = item.total ? Math.round((uploaded / item.total) * 100) : 0;
              return (
                <li
                  key={item.key}
                  data-key={item.key}
                  className={cx(style.queueItem, style[`queue_${status}`])}
                  aria-current={status === 'active' ? 'step' : undefined}
                >
                  <span className={style.queueIcon} aria-hidden="true">
                    {status === 'done' ? (
                      <CheckCircle2 size={16} />
                    ) : status === 'active' ? (
                      <LoaderCircle size={16} className={style.spin} />
                    ) : status === 'failed' ? (
                      <CircleAlert size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                  </span>
                  <span className={style.queueText}>
                    <strong title={item.name}>
                      <span className={style.queueIndex}>{index + 1}.</span> {item.name}
                    </strong>
                    <small>
                      {phase === 'complete' && status === 'done' ? 'Imported' : QUEUE_LABELS[status]} · {item.chapters} ch · {uploaded.toLocaleString()}/{item.total.toLocaleString()} images
                    </small>
                    {status === 'active' ? (
                      <span className={style.queueBar}>
                        <span style={{ width: `${percent}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className={cx(style.queueMeta, 'mono')}>{percent}%</span>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      {result ? (
        <Card title={`Imported comics (${result.comics.length})`}>
          <ul className={style.results}>
            {result.comics.map((comic) => (
              <li key={comic.id}>
                <CheckCircle2 size={16} className={style.resultIcon} />
                <span className={style.resultText}>
                  <strong>{comic.name}</strong>
                  <code>{comic.url}</code>
                </span>
                <span className={style.resultMeta}>
                  {comic.chapters.length} ch · {comic.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="How to prepare the ZIP">
        <article className={style.docs}>
          <p>
            The importer looks for comic folders anywhere in the ZIP. Each comic folder holds a <code>comic.json</code>, one cover
            image and one subfolder per chapter, like this:
          </p>
          <CodeBlock label="Folder structure" code={STRUCTURE_EXAMPLE} />

          <h3>Comic folders</h3>
          <p>
            Any folder that directly contains a <code>comic.json</code> is a comic, at any depth in the ZIP (the ZIP root works
            too). The folder name itself is not used, and each folder holds exactly one comic. Every comic is created as new: an{' '}
            <code>id</code> in <code>comic.json</code> is ignored.
          </p>

          <h3>Cover</h3>
          <p>
            Put exactly one image named <code>cover</code> next to <code>comic.json</code>: <code>cover.jpg</code>,{' '}
            <code>cover.png</code>, <code>cover.webp</code> or <code>cover.gif</code>.
          </p>

          <h3>Chapters</h3>
          <p>
            Every subfolder of the comic folder is a chapter. The first number in its name is the chapter number, so{' '}
            <code>Chapter 12</code>, <code>Ch.12.5</code> and <code>012</code> all work, and anything after <code> - </code>{' '}
            becomes the chapter title (<code>Chapter 2.5 - The Duel</code> is chapter 2.5, &ldquo;The Duel&rdquo;). Folders without
            a number are skipped.
          </p>

          <h3>Pages</h3>
          <p>
            The images directly inside a chapter folder are its pages, ordered by file name the way people count, so{' '}
            <code>2.jpg</code> comes before <code>10.jpg</code>. A chapter needs between 1 and {IMPORT_LIMITS.pagesPerChapter} pages.
            Hidden files, <code>__MACOSX</code>, <code>Thumbs.db</code>, <code>desktop.ini</code> and other non-image files are
            ignored.
          </p>

          <h3>comic.json</h3>
          <p>
            Only <code>name</code> and <code>type</code> are required; everything else is optional.
          </p>
          <ul>
            {FIELDS.map((field) => (
              <li key={field.name}>
                <code>{field.name}</code>
                {field.required ? <span className={style.required}>required</span> : null} — {field.body}
              </li>
            ))}
          </ul>
          <CodeBlock label="comic.json" code={COMIC_JSON_EXAMPLE} />

          <h3>Limits</h3>
          <p>
            The ZIP can be up to {formatBytes(IMPORT_LIMITS.zipBytes)} and may expand to at most{' '}
            {formatBytes(IMPORT_LIMITS.totalBytes)}. Each image can be up to {formatBytes(IMPORT_LIMITS.imageBytes)} and must be a
            JPG, PNG, WEBP or GIF; the real format is read from the file, so a wrong extension is fine. If any file is missing or
            invalid, or a comic&apos;s URL is already taken, the whole import is rejected and nothing is saved.
          </p>
        </article>
      </Card>
    </Page>
  );
}
