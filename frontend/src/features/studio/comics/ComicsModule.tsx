import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ComicContributor } from '../../../types/types';
import { comicApi, comicContributorApi } from '../../../services/api';
import { slugify } from '../../../helpers/utils';
import { useToast } from '../../../context/ToastContext';
import { ComicRow } from '../../../components/UploadComicCard/UploadComicCard';
import ComicForm from '../../../components/ComicForm/ComicForm';
import { comicToForm, emptyComicForm, type ComicFormValues } from '../../../components/ComicForm/comicFormValues';
import Segmented from '../../../components/Segmented/Segmented';
import type { ReviewStatus } from '../../../components/StatusBadge/StatusBadge';
import Page, { Card, Notice, PageState } from '../../../console/ui/Page';
import { Toolbar } from '../../../console/ui/Toolbar';
import { useConsole } from '../../../console/ConsoleContext';
import useQueryState from '../../../console/useQueryState';
import style from './Comics.module.css';

type Filter = 'all' | ReviewStatus;

const EMPTY_TEXT: Record<Filter, string> = {
  all: 'Know a series we are missing? Suggest it.',
  pending: 'Nothing is waiting for review.',
  accept: 'No approved comics yet.',
  reject: 'No rejected comics.',
};

/** /studio/comics: comics I suggested; /new to suggest one; /:comicUrl/edit to change one. */
export default function ComicsModule() {
  return (
    <Routes>
      <Route index element={<ComicsList />} />
      <Route path="new" element={<ComicEditor />} />
      <Route path=":comicUrl/edit" element={<ComicEditor />} />
    </Routes>
  );
}

function ComicsList() {
  const { to } = useConsole();
  const navigate = useNavigate();
  const [{ status }, setQuery] = useQueryState({ status: 'all' });
  const filter = status as Filter;
  const [items, setItems] = useState<ComicContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await comicContributorApi.listMyContributions()) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your comics');
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
      title="My comics"
      description="Series you've suggested for the library. Edits are reviewed by moderators; an approved comic stays published while its edit is in review."
      actions={
        <Link to={to('comics/new')} className="btn btn--primary">
          <Plus size={15} />
          Suggest a comic
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
      <PageState loading={loading} error={error} empty={visible.length === 0} emptyTitle="No comics here" emptyText={EMPTY_TEXT[filter]}>
        <ul className={style.list}>
          {visible.map((c) => (
            <ComicRow
              key={`${c.comicId}-${c.userId}`}
              contributor={c}
              onEdit={() => navigate(to(`comics/${encodeURIComponent(c.comic.url || c.comicId)}/edit`))}
            />
          ))}
        </ul>
      </PageState>
    </Page>
  );
}

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

function ComicEditor() {
  const { comicUrl } = useParams();
  const { to } = useConsole();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(comicUrl);

  const [form, setForm] = useState<ComicFormValues | null>(() => (isEdit ? null : emptyComicForm()));
  const [comicId, setComicId] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!comicUrl) return;
    let cancelled = false;
    comicApi
      .getForEditing(comicUrl)
      .then((comic) => {
        if (cancelled) return;
        setForm(comicToForm(comic));
        setComicId(comic.id);
        setPendingEdit(Boolean(comic.pendingEdit));
        setLive(Boolean(comic.pendingEdit) || comic.status === 'accept');
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load comic details.'));
    return () => {
      cancelled = true;
    };
  }, [comicUrl]);

  // Free the local cover preview when leaving the editor.
  useEffect(() => () => {
    if (form?.coverPreview?.startsWith('blob:')) URL.revokeObjectURL(form.coverPreview);
  }, [form?.coverPreview]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const problem = validate(form, isEdit);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = toFormData(form);
      if (isEdit && comicId) await comicApi.update(comicId, body);
      else await comicApi.create(body);
      toast.success(isEdit ? 'Changes saved. The comic is back in the review queue.' : 'Thanks! Your suggestion is waiting for review.');
      navigate(`${to('comics')}?status=pending`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comic.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title={isEdit ? 'Edit comic' : 'Suggest a comic'}
      description="Comics are reviewed by moderators before they are published."
      back={{ to: to('comics'), label: 'My comics' }}
    >
      <PageState loading={!form && !error} loadingText="Loading comic…" error={!form ? error : null}>
        {form ? (
          <Card>
            <form className={style.form} onSubmit={submit}>
              {pendingEdit ? (
                <Notice tone="info">
                  Your previous changes are still waiting for review and are shown below. Readers see the approved version
                  until a moderator decides; saving again replaces those changes.
                </Notice>
              ) : live ? (
                <Notice tone="info">This comic is published. Your changes go live only after a moderator approves them.</Notice>
              ) : null}
              <ComicForm values={form} onChange={setForm} />
              {error ? <Notice tone="err">{error}</Notice> : null}
              <div className={style.actions}>
                <Link to={to('comics')} className="btn btn--ghost">
                  Cancel
                </Link>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Submit suggestion'}
                </button>
              </div>
            </form>
          </Card>
        ) : null}
      </PageState>
    </Page>
  );
}
