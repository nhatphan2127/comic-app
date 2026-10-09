import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, FilePlus2 } from 'lucide-react';
import { apiKeyApi, comicApi, type UploadableComic } from '../../../services/api';
import type { Comic } from '../../../types/types';
import { CONTENT_RATING_OPTIONS, DEMOGRAPHIC_OPTIONS, FORMAT_OPTIONS, GENRE_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from '../../../constants/comicOptions';
import { resolveUploadUrl } from '../../../helpers/getImage';
import Page, { Notice, PageState } from '../../../console/ui/Page';
import { SearchField, Toolbar } from '../../../console/ui/Toolbar';
import ManageRow, { ManageList } from '../../../console/ui/ManageRow';
import Pagination from '../../../components/Pagination/Pagination';
import useQueryState from '../../../console/useQueryState';
import { useConsole } from '../../../console/ConsoleContext';

type Tree = { [name: string]: Uint8Array | Tree };

const PAGE_SIZE = 20;
const lower = (values: readonly string[]) => values.map((v) => v.toLowerCase());

/** A folder name every OS accepts. */
const folderName = (name: string) => name.replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '') || 'comic';

const json = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

const NEW_COMIC_JSON = {
  _note: 'New comic: fill this in, put cover.jpg (or .png / .webp) next to it, add chapter folders, run the uploader. Keys starting with _ are ignored.',
  name: '',
  url: '',
  type: '',
  demographic: '',
  contentRating: '',
  releaseStatus: 'releasing',
  releasingYear: '',
  author: '',
  artist: '',
  genres: [],
  formats: [],
  description: '',
  source: '',
  _allowed: {
    type: lower(TYPE_OPTIONS),
    demographic: lower(DEMOGRAPHIC_OPTIONS),
    contentRating: lower(CONTENT_RATING_OPTIONS),
    releaseStatus: lower(STATUS_OPTIONS),
    genres: GENRE_OPTIONS,
    formats: FORMAT_OPTIONS,
  },
};

/** comic.json for a comic already on the site. `detail` is missing when the public page can't show it (hidden comics). */
function existingComicJson(row: UploadableComic, detail: Comic | null) {
  return {
    _note: 'Existing comic: the uploader only adds chapters to it. Change its details or cover in Studio, not here.',
    id: row.id,
    url: row.url,
    name: row.name,
    type: row.types?.toLowerCase(),
    ...(detail && {
      demographic: detail.demographic?.toLowerCase(),
      contentRating: detail.contentRating?.toLowerCase(),
      releaseStatus: detail.releaseStatus?.toLowerCase(),
      releasingYear: detail.releasingYear,
      author: detail.author,
      artist: detail.artist,
      genres: detail.genres ?? [],
      formats: detail.formats ?? [],
      description: detail.description,
      source: detail.source,
    }),
  };
}

async function saveZip(fileName: string, tree: Tree) {
  const { zipSync } = await import('fflate');
  const href = URL.createObjectURL(new Blob([zipSync(tree)], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** The current cover, so the folder looks like the comic. Optional: existing comics don't need one. */
async function fetchCover(coverUrl?: string | null): Promise<[string, Uint8Array] | null> {
  const src = resolveUploadUrl(coverUrl);
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[res.headers.get('content-type') ?? ''] ?? 'jpg';
    return [`cover.${ext}`, new Uint8Array(await res.arrayBuffer())];
  } catch {
    return null;
  }
}

/** /studio/comic-folders: every comic the user can upload chapters to, each downloadable as a ready-made upload folder. */
export default function ComicFoldersModule() {
  const { to } = useConsole();
  const [{ q, page: pageParam }, setQuery] = useQueryState({ q: '', page: '1' });
  const page = Math.max(1, Number(pageParam) || 1);
  const [items, setItems] = useState<UploadableComic[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiKeyApi
      .listUploadableComics({ q: q || undefined, page, pageSize: PAGE_SIZE })
      .then(({ data, meta }) => {
        if (cancelled) return;
        setItems(data);
        setTotalPages(Math.max(1, meta.totalPages || 1));
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load comics'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q, page]);

  const search = useCallback((value: string) => setQuery({ q: value.trim() }), [setQuery]);

  const download = async (row: UploadableComic) => {
    setBusy(row.id);
    setNotice(null);
    try {
      const [detail, cover] = await Promise.all([comicApi.getByUrl(row.url).catch(() => null), fetchCover(row.coverUrl)]);
      const folder: Tree = {
        'comic.json': json(existingComicJson(row, detail)),
        [`Chapter ${row.latestChapter === null ? 1 : Math.floor(row.latestChapter) + 1}`]: {},
      };
      if (cover) folder[cover[0]] = cover[1];
      await saveZip(`${row.url}.zip`, { [folderName(row.name)]: folder });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = () =>
    void saveZip('new-comic.zip', { 'New comic': { 'comic.json': json(NEW_COMIC_JSON), 'Chapter 1': {} } }).catch(() => setNotice('Download failed'));

  return (
    <Page
      title="Comic folders"
      description="Every comic you can upload chapters to. Download its folder, drop chapter folders into it and run the uploader script."
      actions={
        <>
          <Link to={to('api-guide')} className="btn btn--ghost">
            <BookOpen size={15} />
            API guide
          </Link>
          <button type="button" className="btn btn--primary" onClick={downloadTemplate}>
            <FilePlus2 size={15} />
            New comic template
          </button>
        </>
      }
    >
      <Toolbar>
        <SearchField value={q} onChange={search} placeholder="Search by name or url…" debounceMs={300} />
      </Toolbar>
      {notice ? <Notice tone="err">{notice}</Notice> : null}
      <PageState
        loading={loading}
        error={error}
        empty={items.length === 0}
        emptyTitle={q ? 'No comics found' : 'No comics to upload to yet'}
        emptyText={q ? 'Try another name or url. Not on the site yet? Start from the new comic template.' : 'Start from the new comic template.'}
      >
        <ManageList>
          {items.map((comic) => (
            <ManageRow
              key={comic.id}
              cover={comic.coverUrl}
              title={comic.name}
              meta={[
                <code key="url" className="mono">
                  {comic.url}
                </code>,
                comic.types,
                comic.latestChapter === null ? 'No chapters yet' : `Latest chapter ${comic.latestChapter}`,
                comic.mine ? (
                  <span key="mine" className="badge badge--brand">
                    Yours
                  </span>
                ) : null,
                comic.status !== 'accept' ? (
                  <span key="status" className="badge badge--warn">
                    In review
                  </span>
                ) : null,
                comic.visibility === 'hidden' ? (
                  <span key="hidden" className="badge">
                    Hidden
                  </span>
                ) : null,
              ]}
              actions={
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy === comic.id} onClick={() => void download(comic)}>
                  <Download size={14} />
                  {busy === comic.id ? 'Preparing…' : 'Download folder'}
                </button>
              }
            />
          ))}
        </ManageList>
      </PageState>
      {totalPages > 1 ? <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setQuery({ page: String(p) })} isLoading={loading} /> : null}
    </Page>
  );
}
