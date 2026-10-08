import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import type { Chapter, ChapterContributor } from '../../../../types/types';
import { chapterContributorApi, comicApi } from '../../../../services/api';
import { slugify } from '../../../../helpers/utils';
import { ChapterRow } from '../../../../components/UploadChapterCard/UploadChapterCard';
import Segmented from '../../../../components/Segmented/Segmented';
import type { ReviewStatus } from '../../../../components/StatusBadge/StatusBadge';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import ChapterPagesPicker, { type ChapterPage } from './ChapterPagesPicker';
import style from './UploadedChaptersPanel.module.css';

type Tab = 'all' | ReviewStatus;
type Contribution = ChapterContributor & { chapter?: Chapter };

const EMPTY_TEXT: Record<Tab, string> = {
  all: 'Upload a chapter to help grow the library.',
  pending: 'Nothing is waiting for review.',
  accept: 'No approved uploads yet.',
  reject: 'No rejected uploads.',
};

const EMPTY_FORM = { comicUrl: '', chapterNumber: '', title: '' };

export default function UploadedChaptersPanel() {
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [comic, setComic] = useState<{ id: string; name: string } | null>(null);
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await chapterContributorApi.listMyContributions()) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const count = (s: ReviewStatus) => items.filter((c) => c.status === s).length;
  const visible = items.filter((c) => tab === 'all' || c.status === tab);

  const lookupComic = async () => {
    const slug = form.comicUrl.trim();
    if (!slug) return setComic(null);
    try {
      const found = await comicApi.getByUrl(slug);
      setComic({ id: found.id, name: found.name || 'Untitled' });
      setFormError(null);
    } catch {
      setComic(null);
      setFormError('No comic found with that URL.');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setComic(null);
    setPages([]);
    setFormError(null);
  };

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
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Chapter upload failed.');
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <PanelShell
        title="Upload a chapter"
        subtitle="Uploads are reviewed by moderators before they go live."
        actions={
          <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
            <ArrowLeft size={14} />
            Back
          </button>
        }
      >
        <form className={style.form} onSubmit={submit}>
          <div className={style.grid}>
            <label className={style.field}>
              <span>Comic URL</span>
              <input
                className="input"
                placeholder="e.g. solo-leveling"
                value={form.comicUrl}
                onChange={(e) => setForm((f) => ({ ...f, comicUrl: e.target.value }))}
                onBlur={lookupComic}
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
            <input
              className="input"
              placeholder="Chapter title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>

          <div className={style.field}>
            <span>Pages</span>
            <ChapterPagesPicker pages={pages} onChange={setPages} onError={setFormError} />
          </div>

          {formError ? <div className={style.error}>{formError}</div> : null}

          <div className={style.actions}>
            <button type="button" className="btn btn--ghost" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Uploading…' : 'Upload chapter'}
            </button>
          </div>
        </form>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Chapter uploads"
      subtitle="Track the chapters you've contributed and their review status."
      actions={
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowForm(true)}>
          <Plus size={14} />
          Upload chapter
        </button>
      }
    >
      <Segmented
        ariaLabel="Filter by status"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All', count: items.length },
          { value: 'pending', label: 'Pending', count: count('pending') },
          { value: 'accept', label: 'Approved', count: count('accept') },
          { value: 'reject', label: 'Rejected', count: count('reject') },
        ]}
      />

      <PanelState loading={loading} error={error} empty={visible.length === 0} emptyTitle="No uploads here" emptyText={EMPTY_TEXT[tab]}>
        <ul className={style.list}>
          {visible.map((c) => (
            <ChapterRow key={`${c.chapterId}-${c.userId}`} contributor={c} />
          ))}
        </ul>
      </PanelState>
    </PanelShell>
  );
}
