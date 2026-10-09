import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Plus } from 'lucide-react';
import type { Chapter, ChapterContributor } from '../../../types/types';
import { chapterContributorApi, comicApi } from '../../../services/api';
import { slugify } from '../../../helpers/utils';
import { useToast } from '../../../context/ToastContext';
import { ChapterRow } from '../../../components/UploadChapterCard/UploadChapterCard';
import Segmented from '../../../components/Segmented/Segmented';
import type { ReviewStatus } from '../../../components/StatusBadge/StatusBadge';
import Page, { Card, Notice, PageState } from '../../../console/ui/Page';
import { Toolbar } from '../../../console/ui/Toolbar';
import { useConsole } from '../../../console/ConsoleContext';
import useQueryState from '../../../console/useQueryState';
import ChapterPagesPicker, { type ChapterPage } from './ChapterPagesPicker';
import style from './Uploads.module.css';

type Filter = 'all' | ReviewStatus;
type Contribution = ChapterContributor & { chapter?: Chapter };

const EMPTY_TEXT: Record<Filter, string> = {
  all: 'Upload a chapter to help grow the library.',
  pending: 'Nothing is waiting for review.',
  accept: 'No approved uploads yet.',
  reject: 'No rejected uploads.',
};

/** /studio/uploads: my chapter uploads, and /studio/uploads/new to add one. */
export default function UploadsModule() {
  return (
    <Routes>
      <Route index element={<UploadsList />} />
      <Route path="new" element={<UploadForm />} />
    </Routes>
  );
}

function UploadsList() {
  const { to } = useConsole();
  const [{ status }, setQuery] = useQueryState({ status: 'all' });
  const filter = status as Filter;
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await chapterContributorApi.listMyContributions()) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your uploads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const count = (s: ReviewStatus) => items.filter((c) => c.status === s).length;
  const visible = items.filter((c) => filter === 'all' || c.status === filter);

  return (
    <Page
      title="Chapter uploads"
      description="Chapters you've uploaded and where they are in review."
      actions={
        <Link to={to('uploads/new')} className="btn btn--primary">
          <Plus size={15} />
          Upload chapter
        </Link>
      }
    >
      <Toolbar>
        <Segmented
          ariaLabel="Filter by status"
          value={filter}
          onChange={(v) => setQuery({ status: v })}
          options={[
            { value: 'all', label: 'All', count: items.length },
            { value: 'pending', label: 'Pending', count: count('pending') },
            { value: 'accept', label: 'Approved', count: count('accept') },
            { value: 'reject', label: 'Rejected', count: count('reject') },
          ]}
        />
      </Toolbar>

      <PageState loading={loading} error={error} empty={visible.length === 0} emptyTitle="No uploads here" emptyText={EMPTY_TEXT[filter]}>
        <ul className={style.list}>
          {visible.map((c) => (
            <ChapterRow key={`${c.chapterId}-${c.userId}`} contributor={c} />
          ))}
        </ul>
      </PageState>
    </Page>
  );
}

const EMPTY_FORM = { comicUrl: '', chapterNumber: '', title: '' };

function UploadForm() {
  const { to } = useConsole();
  const navigate = useNavigate();
  const toast = useToast();
  // A comic page can link here with ?comic=<url> to pre-fill the comic.
  const [params] = useSearchParams();
  const [form, setForm] = useState({ ...EMPTY_FORM, comicUrl: params.get('comic') ?? '' });
  const [comic, setComic] = useState<{ id: string; name: string } | null>(null);
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lookupComic = useCallback(async (slug: string) => {
    if (!slug.trim()) return setComic(null);
    try {
      const found = await comicApi.getByUrl(slug.trim());
      setComic({ id: found.id, name: found.name || 'Untitled' });
      setFormError(null);
    } catch {
      setComic(null);
      setFormError('No comic found with that URL.');
    }
  }, []);

  useEffect(() => {
    const preset = params.get('comic');
    if (preset) void lookupComic(preset);
  }, [params, lookupComic]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const missing =
      (!form.comicUrl.trim() && 'Comic URL is required.') ||
      (!comic && 'Please enter a valid comic URL first.') ||
      (!form.chapterNumber && 'Chapter number is required.') ||
      (!form.title.trim() && 'Chapter title is required.') ||
      (pages.length === 0 && 'Please add the chapter pages.');
    if (missing || !comic) {
      setFormError(missing || null);
      return;
    }

    const body = new FormData();
    body.append('title', form.title.trim());
    body.append('chapterNumber', form.chapterNumber.trim());
    body.append('url', slugify(`${form.comicUrl.trim()}-${form.chapterNumber.trim()}`));
    pages.forEach((p) => body.append('images', p.file)); // server numbers pages in upload order

    setSaving(true);
    try {
      await comicApi.createChapter(comic.id, body);
      toast.success('Chapter uploaded. It will go live once a moderator approves it.');
      navigate(`${to('uploads')}?status=pending`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Chapter upload failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Upload a chapter" description="Uploads are reviewed by moderators before they go live." back={{ to: to('uploads'), label: 'Chapter uploads' }}>
      <Card>
        <form className={style.form} onSubmit={submit}>
          <div className={style.grid}>
            <label className={style.field}>
              <span>Comic URL</span>
              <input
                className="input"
                placeholder="e.g. solo-leveling"
                value={form.comicUrl}
                onChange={(e) => setForm((f) => ({ ...f, comicUrl: e.target.value }))}
                onBlur={() => void lookupComic(form.comicUrl)}
              />
              {comic ? (
                <span className={style.found}>
                  <CheckCircle2 size={13} /> {comic.name}
                </span>
              ) : null}
            </label>
            <label className={style.field}>
              <span>Chapter number</span>
              <input
                className="input"
                type="number"
                min={1}
                value={form.chapterNumber}
                onChange={(e) => setForm((f) => ({ ...f, chapterNumber: e.target.value }))}
              />
            </label>
          </div>

          <label className={style.field}>
            <span>Chapter title</span>
            <input className="input" placeholder="Chapter title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>

          <div className={style.field}>
            <span>Pages</span>
            <ChapterPagesPicker pages={pages} onChange={setPages} onError={setFormError} />
          </div>

          {formError ? <Notice tone="err">{formError}</Notice> : null}

          <div className={style.actions}>
            <Link to={to('uploads')} className="btn btn--ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Uploading…' : 'Upload chapter'}
            </button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
