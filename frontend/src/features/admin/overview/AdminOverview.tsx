import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookCopy, Files, Flag, ShieldCheck, UserPlus, Users, UsersRound } from 'lucide-react';
import { adminApi } from '../../../services/api';
import type { Chapter, Comic, DashboardResponse } from '../../../types/types';
import { formatTimeAgo } from '../../../helpers/formatDate';
import Avatar from '../../../components/Avatar/Avatar';
import { resolveUploadUrl } from '../../../helpers/getImage';
import Page, { Card, PageState } from '../../../console/ui/Page';
import { StatCard, StatGrid } from '../../../console/ui/StatCard';
import ManageRow, { ManageList } from '../../../console/ui/ManageRow';
import { useConsole } from '../../../console/ConsoleContext';
import style from './AdminOverview.module.css';

/** /admin: platform numbers and what needs attention. */
export default function AdminOverview() {
  const { to } = useConsole();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getDashboard()
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load the dashboard'));
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = data?.totals;
  const waiting: (Comic | Chapter)[] = [...(data?.comics ?? []), ...(data?.chapters ?? [])]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 6);

  return (
    <Page title="Overview" description="How the platform is doing and what needs your attention.">
      <PageState loading={!data && !error} error={error}>
        {totals ? (
          <>
            <StatGrid>
              <StatCard label="Contributor requests" value={totals.pendingRoleRequests} icon={UserPlus} tone="accent" to={to('role-requests')} hint="Waiting for a decision" />
              <StatCard label="Waiting for review" value={totals.pendingReviews} icon={ShieldCheck} tone="warn" to="/studio/queue" hint="Opens the Studio queue" />
              <StatCard label="Open reports" value={totals.openReports} icon={Flag} tone="err" to="/studio/reports" />
            </StatGrid>
            <StatGrid>
              <StatCard label="Users" value={totals.users} icon={Users} tone="info" to={to('users')} />
              <StatCard label="Staff & contributors" value={totals.staff} icon={UsersRound} tone="info" to={`${to('users')}?role=contributor`} />
              <StatCard label="Comics" value={totals.comics} icon={BookCopy} tone="ok" to={to('comics')} />
              <StatCard label="Chapters" value={totals.chapters} icon={Files} tone="ok" to={to('chapters')} />
            </StatGrid>

            <div className={style.columns}>
              <Card
                title="Newest members"
                actions={
                  <Link to={to('users')} className="btn btn--ghost btn--sm">
                    All users
                  </Link>
                }
              >
                <ManageList>
                  {data.users.slice(0, 6).map((u) => (
                    <ManageRow
                      key={u.id}
                      leading={<Avatar name={u.displayName || u.username} src={resolveUploadUrl(u.avatar)} size={36} />}
                      title={<Link to={`/users/${u.id}`}>{u.displayName || u.username}</Link>}
                      meta={[`@${u.username}`, u.createdAt ? `Joined ${formatTimeAgo(u.createdAt)}` : null]}
                      actions={<span className="badge">{u.role ?? 'user'}</span>}
                    />
                  ))}
                </ManageList>
              </Card>

              <Card
                title="Latest submissions"
                actions={
                  <Link to="/studio/queue" className="btn btn--ghost btn--sm">
                    Review queue
                  </Link>
                }
              >
                {waiting.length ? (
                  <ManageList>
                    {waiting.map((item) => {
                      const isComic = 'name' in item;
                      return (
                        <ManageRow
                          key={item.id}
                          cover={isComic ? (item as Comic).coverUrl : undefined}
                          title={isComic ? (item as Comic).name : `Chapter ${(item as Chapter).chapterNumber}${(item as Chapter).title ? ` · ${(item as Chapter).title}` : ''}`}
                          meta={[<span key="kind" className="badge badge--warn">{isComic ? 'Comic' : 'Chapter'}</span>, formatTimeAgo(item.updatedAt || item.createdAt)]}
                        />
                      );
                    })}
                  </ManageList>
                ) : (
                  <div className="empty-state">
                    <strong>All caught up</strong>
                    Nothing is waiting for review.
                  </div>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </PageState>
    </Page>
  );
}
