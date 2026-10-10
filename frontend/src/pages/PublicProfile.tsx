import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, CalendarDays, ExternalLink, MoreHorizontal, Pencil } from 'lucide-react';
import HeaderLayout from '../layout/HeaderLayout/HeaderLayout';
import { publicUserApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { PublicProfile as Profile, UserComment } from '../types/types';
import { resolveUploadUrl } from '../helpers/getImage';
import { formatCount } from '../helpers/utils';
import { parseServerDate } from '../helpers/formatDate';
import Avatar from '../components/Avatar/Avatar';
import Dropdown, { DropdownItem } from '../components/Dropdown/Dropdown';
import Pagination from '../components/Pagination/Pagination';
import UserCommentList from '../components/UserCommentList/UserCommentList';
import NotFound from './NotFound';
import styles from './PublicProfile.module.css';

const PAGE_SIZE = 10;

// Staff roles are worth showing; plain readers get no badge.
const ROLE_LABEL: Record<string, string> = { contributor: 'Contributor', moderator: 'Moderator', admin: 'Admin' };

/** Only http(s) links are shown, one per line in the profile's "social links". */
const parseLinks = (text?: string | null) =>
  (text ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));

export default function PublicProfile() {
  const { userId = '' } = useParams<{ userId: string }>();
  const { user: me } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [comments, setComments] = useState<UserComment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [blockBusy, setBlockBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setMissing(false);
    setPage(1);
    publicUserApi
      .get(userId)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [userId, me?.id]); // `me?.id`: logging in or out changes `isBlocked`

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    publicUserApi
      .getComments(userId, page, PAGE_SIZE)
      .then(({ comments: items, meta }) => {
        if (cancelled) return;
        setComments(items);
        setTotalPages(Math.max(1, meta.totalPages));
      })
      .catch(() => !cancelled && setComments([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, page]);

  if (missing) return <NotFound />;

  // Blocking only hides this user's comments from me; the profile stays visible.
  const setBlocked = async (blocked: boolean) => {
    if (!profile) return;
    const who = profile.displayName || profile.username;
    if (blocked && !window.confirm(`Block ${who}? Their comments and the replies under them will be hidden from you.`)) return;
    setBlockBusy(true);
    try {
      await (blocked ? userApi.blockUser(userId) : userApi.unblockUser(userId));
      setProfile({ ...profile, isBlocked: blocked });
      toast.success(blocked ? `${who} is blocked.` : `${who} is unblocked.`);
    } catch (err) {
      toast.error(err, blocked ? 'Could not block this user.' : 'Could not unblock this user.');
    } finally {
      setBlockBusy(false);
    }
  };

  const name = profile?.displayName || profile?.username || '…';
  const background = resolveUploadUrl(profile?.background);
  const links = parseLinks(profile?.socialLinks);
  const role = profile?.role ? ROLE_LABEL[profile.role] : undefined;

  return (
    <>
      <HeaderLayout />
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.banner} style={background ? { backgroundImage: `url("${background}")` } : undefined} />
          <div className={styles.row}>
            <Avatar name={name} src={resolveUploadUrl(profile?.avatar)} size={104} className={styles.avatar} />
            <div className={styles.identity}>
              <h1 className={styles.name}>
                {name}
                {role ? <span className="badge badge--brand">{role}</span> : null}
              </h1>
              {profile ? <p className={`${styles.handle} mono`}>@{profile.username}</p> : null}
            </div>
            {me?.id === userId ? (
              <Link to="/profile?tab=edit-profile" className="btn btn--ghost btn--sm">
                <Pencil size={14} />
                Edit profile
              </Link>
            ) : me && profile ? (
              profile.isBlocked ? (
                <button type="button" className="btn btn--ghost btn--sm" disabled={blockBusy} onClick={() => setBlocked(false)}>
                  Unblock
                </button>
              ) : (
                <Dropdown
                  align="right"
                  ariaLabel="More actions"
                  trigger={<MoreHorizontal size={16} />}
                  triggerClassName="btn btn--ghost btn--sm btn--icon"
                >
                  {(close) => (
                    <DropdownItem
                      danger
                      icon={<Ban size={14} />}
                      onClick={() => {
                        close();
                        void setBlocked(true);
                      }}
                    >
                      Block user
                    </DropdownItem>
                  )}
                </Dropdown>
              )
            ) : null}
          </div>

          {profile?.isBlocked ? (
            <p className={styles.blockedNote}>
              <Ban size={14} />
              You blocked this user. Their comments are hidden from you in discussions.
            </p>
          ) : null}

          {profile?.bio ? <p className={styles.bio}>{profile.bio}</p> : null}

          <div className={styles.facts}>
            {profile?.createdAt ? (
              <span>
                <CalendarDays size={14} />
                Joined {parseServerDate(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
              </span>
            ) : null}
            {links.map((href) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer nofollow">
                <ExternalLink size={14} />
                {href.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
              </a>
            ))}
          </div>

          <dl className={styles.stats}>
            {[
              { label: 'Following', value: profile?.stats.following },
              { label: 'Comments', value: profile?.stats.comments },
              { label: 'Likes received', value: profile?.stats.likes },
            ].map((s) => (
              <div key={s.label}>
                <dd>{formatCount(s.value ?? 0)}</dd>
                <dt>{s.label}</dt>
              </div>
            ))}
          </dl>
        </header>

        <section className={styles.section} aria-labelledby="comments-heading">
          <h2 id="comments-heading" className={styles.sectionTitle}>
            Comments
          </h2>
          {loading && comments.length === 0 ? (
            <div className="empty-state">Loading comments…</div>
          ) : comments.length === 0 ? (
            <div className="empty-state">No comments yet.</div>
          ) : (
            <>
              <UserCommentList comments={comments} />
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={loading} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
