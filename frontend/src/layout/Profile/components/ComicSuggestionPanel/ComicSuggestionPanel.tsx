import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import type { ComicContributor } from '../../../../types/types';
import { comicApi, comicContributorApi } from '../../../../services/api';
import { slugify } from '../../../../helpers/utils';
import { ComicRow } from '../../../../components/UploadComicCard/UploadComicCard';
import ComicForm from '../../../../components/ComicForm/ComicForm';
import { comicToForm, emptyComicForm, type ComicFormValues } from '../../../../components/ComicForm/comicFormValues';
import Segmented from '../../../../components/Segmented/Segmented';
import type { ReviewStatus } from '../../../../components/StatusBadge/StatusBadge';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';
import cx from '../../../../helpers/cx';
import style from './ComicSuggestionPanel.module.css';

type Tab = 'all' | ReviewStatus;
type Notice = { tone: 'ok' | 'err'; text: string } | null;

const EMPTY_TEXT: Record<Tab, string> = {
  all: 'Know a series we are missing? Suggest it.',
  pending: 'Nothing is waiting for review.',
  accept: 'No approved suggestions yet.',
  reject: 'No rejected suggestions.',
};

/** Returns the first validation error, or null when the form can be submitted. */
function validate(v: ComicFormValues, isEdit: boolean): string | null {
  if (!v.name.trim()) return 'Comic title is required.';
  if (!v.url.trim()) return 'URL slug is required.';
  if (!v.type) return 'Please choose a type.';
  if (!v.demographic) return 'Please choose a demographic.';
  if (!v.contentRating) return 'Please choose a content rating.';
  if (!isEdit && !v.cover && !v.coverPreview) return 'A cover image is required.';
  return null;
}

function toFormData(v: ComicFormValues): FormData {
  const body = new FormData();
  body.append('name', v.name.trim());
  body.append('source', v.source.trim());
  body.append('url', slugify(v.url.trim()));
  body.append('description', v.description.trim());
  body.append('types', v.type);
  body.append('contentRating', v.contentRating.toLowerCase());
  body.append('demographic', v.demographic);
  body.append('releaseStatus', v.releaseStatus || 'releasing');
  body.append('releasingYear', String(v.releasingYear));
  if (v.author.trim()) body.append('author', v.author.trim());
  if (v.artist.trim()) body.append('artist', v.artist.trim());
  if (v.cover) body.append('coverImage', v.cover);
  v.genres.forEach((g) => body.append('genres', g));
  v.formats.forEach((f) => body.append('formats', f));
  return body;
}

export default function ComicSuggestionPanel() {
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<ComicContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ComicFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await comicContributorApi.listMyContributions()) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    if (form?.coverPreview?.startsWith('blob:')) URL.revokeObjectURL(form.coverPreview);
    setForm(null);
    setEditingId(null);
  };

  const openEdit = async (c: ComicContributor) => {
    setNotice(null);
    try {
      const comic = await comicApi.getByUrl(c.comic.url || c.comicId);
      setForm(comicToForm(comic));
      setEditingId(c.comicId);
    } catch (err) {
      setNotice({ tone: 'err', text: err instanceof Error ? err.message : 'Failed to load comic details.' });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const problem = validate(form, Boolean(editingId));
    if (problem) {
      setNotice({ tone: 'err', text: problem });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const body = toFormData(form);
      if (editingId) await comicApi.update(editingId, body);
      else await comicApi.create(body);
      closeForm();
      setTab('pending');
      setNotice({ tone: 'ok', text: editingId ? 'Changes saved — the comic is back in the review queue.' : 'Thanks! Your suggestion is waiting for review.' });
      await load();
    } catch (err) {
      setNotice({ tone: 'err', text: err instanceof Error ? err.message : 'Failed to save comic.' });
    } finally {
      setSaving(false);
    }
  };

  const noticeEl = notice ? (
    <div className={cx(style.notice, notice.tone === 'ok' ? style.noticeOk : style.noticeErr)} role="status">
      {notice.text}
    </div>
  ) : null;

  if (form) {
    return (
      <PanelShell
        title={editingId ? 'Edit suggestion' : 'Suggest a comic'}
        subtitle="Suggestions are reviewed by moderators before they are published."
        actions={
          <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
            <ArrowLeft size={14} />
            Back
          </button>
        }
      >
        <form className={style.card} onSubmit={submit}>
          <ComicForm values={form} onChange={setForm} />
          {noticeEl}
          <div className={style.actions}>
            <button type="button" className="btn btn--ghost" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Submit suggestion'}
            </button>
          </div>
        </form>
      </PanelShell>
    );
  }

  const count = (s: ReviewStatus) => items.filter((c) => c.status === s).length;
  const visible = items.filter((c) => tab === 'all' || c.status === tab);

  return (
    <PanelShell
      title="Comic suggestions"
      subtitle="Series you've proposed for the library."
      actions={
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            setNotice(null);
            setForm(emptyComicForm());
          }}
        >
          <Plus size={14} />
          Suggest comic
        </button>
      }
    >
      {noticeEl}
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
      <PanelState loading={loading} error={error} empty={visible.length === 0} emptyTitle="No suggestions here" emptyText={EMPTY_TEXT[tab]}>
        <ul className={style.list}>
          {visible.map((c) => (
            <ComicRow key={`${c.comicId}-${c.userId}`} contributor={c} onEdit={() => void openEdit(c)} />
          ))}
        </ul>
      </PanelState>
    </PanelShell>
  );
}
