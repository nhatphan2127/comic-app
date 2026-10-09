import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookCopy, BookUp, CheckCircle2, Clock3, Flag, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { chapterContributorApi, comicContributorApi, moderationApi } from '../../../services/api';
import type { ChapterContributor, ComicContributor } from '../../../types/types';
import { useAuth } from '../../../context/AuthContext';
import { canModerate } from '../../../helpers/roles';
import { ChapterRow } from '../../../components/UploadChapterCard/UploadChapterCard';
import Page, { Card, PageState } from '../../../console/ui/Page';
import { StatCard, StatGrid } from '../../../console/ui/StatCard';
import { useConsole } from '../../../console/ConsoleContext';
import style from './StudioOverview.module.css';

interface Data {
  chapters: ChapterContributor[];
  comics: ComicContributor[];
  pendingReviews?: number;
  openReports?: number;
}

const byStatus = <T extends { status: string }>(items: T[], status: string) => items.filter((i) => i.status === status).length;

/** /studio: what I contributed at a glance, plus the moderation workload for moderators. */
export default function StudioOverview() {
  const { user } = useAuth();
  const { to } = useConsole();
  const isModerator = canModerate(user?.role);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      chapterContributorApi.listMyContributions(),
      comicContributorApi.listMyContributions(),
      isModerator ? moderationApi.countPending() : Promise.resolve(undefined),
      isModerator ? moderationApi.countReports('open') : Promise.resolve(undefined),
    ])
      .then(([chapters, comics, pendingReviews, openReports]) => {
        if (!cancelled) setData({ chapters: chapters || [], comics: comics || [], pendingReviews, openReports });
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load the overview'));
    return () => {
      cancelled = true;
    };
  }, [isModerator]);

  const name = user?.displayName || user?.userName || 'there';
  const recent = [...(data?.chapters ?? [])].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);

  return (
    <Page
      title={`Welcome back, ${name}`}
      description="Upload chapters, suggest comics and follow their review here."
      actions={
        <>
          <Link to={to('comics/new')} className="btn btn--ghost">
            <BookUp size={15} />
            Suggest a comic
          </Link>
          <Link to={to('uploads/new')} className="btn btn--primary">
            <Upload size={15} />
            Upload chapter
          </Link>
        </>
      }
    >
      <PageState loading={!data && !error} error={error}>
        {data ? (
          <>
            {isModerator ? (
              <section className={style.section}>
                <h2 className={style.heading}>Moderation</h2>
                <StatGrid>
                  <StatCard label="Waiting for review" value={data.pendingReviews ?? 0} icon={ShieldCheck} tone="warn" to={to('queue')} hint="Comics and chapters" />
                  <StatCard label="Open reports" value={data.openReports ?? 0} icon={Flag} tone="err" to={to('reports')} />
                </StatGrid>
              </section>
            ) : null}

            <section className={style.section}>
              <h2 className={style.heading}>My contributions</h2>
              <StatGrid>
                <StatCard label="Chapters uploaded" value={data.chapters.length} icon={Upload} to={to('uploads')} />
                <StatCard label="Pending" value={byStatus(data.chapters, 'pending')} icon={Clock3} tone="warn" to={`${to('uploads')}?status=pending`} />
                <StatCard label="Approved" value={byStatus(data.chapters, 'accept')} icon={CheckCircle2} tone="ok" to={`${to('uploads')}?status=accept`} />
                <StatCard label="Rejected" value={byStatus(data.chapters, 'reject')} icon={XCircle} tone="err" to={`${to('uploads')}?status=reject`} />
                <StatCard
                  label="Comics suggested"
                  value={data.comics.length}
                  icon={BookCopy}
                  tone="info"
                  to={to('comics')}
                  hint={`${byStatus(data.comics, 'accept')} approved`}
                />
              </StatGrid>
            </section>

            <Card
              title="Recent uploads"
              actions={
                <Link to={to('uploads')} className="btn btn--ghost btn--sm">
                  View all
                </Link>
              }
            >
              {recent.length ? (
                <ul className={style.list}>
                  {recent.map((c) => (
                    <ChapterRow key={`${c.chapterId}-${c.userId}`} contributor={c} />
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <strong>No uploads yet</strong>
                  Your first chapter will show up here.
                </div>
              )}
            </Card>
          </>
        ) : null}
      </PageState>
    </Page>
  );
}
