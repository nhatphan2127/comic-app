import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { chapterApi, comicApi, commentApi, userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Comment } from '../../types/types';
import AuthModalLayout from '../../layout/AuthModalLayout/AuthModalLayout';
import Avatar from '../Avatar/Avatar';
import CommentEditor from './CommentEditor';
import CommentItem, { type CommentActions, type Reaction } from './CommentItem';
import { parseServerDate } from '../../helpers/formatDate';
import cx from '../../helpers/cx';
import styles from './CommentsSection.module.css';

type SortBy = 'best' | 'newest' | 'oldest';
const PAGE_SIZE = 10;
const SORTS: { id: SortBy; label: string }[] = [
  { id: 'best', label: 'Top' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
];

const score = (c: Comment) => (c.like || 0) - (c.dislike || 0);
const time = (c: Comment) => parseServerDate(c.createdAt).getTime();
const SORTERS: Record<SortBy, (a: Comment, b: Comment) => number> = {
  best: (a, b) => score(b) - score(a),
  newest: (a, b) => time(b) - time(a),
  oldest: (a, b) => time(a) - time(b),
};

interface CommentsSectionProps {
  /** Comic id or chapter id, depending on `type`. */
  id?: string;
  /** Comment to highlight and scroll to (from ?cm_id=). */
  targetId?: string;
  type?: 'comic' | 'chapter';
}

export default function CommentsSection({ id = '', targetId, type = 'comic' }: CommentsSectionProps) {
  const { isLoggedIn, user } = useAuth();
  const currentUserName = user?.displayName || user?.userName || 'You';
  const api = type === 'comic' ? comicApi : chapterApi;

  const [comments, setComments] = useState<Comment[]>([]);
  const [targetComment, setTargetComment] = useState<Comment | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('best');
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data =
          type === 'comic'
            ? await comicApi.getComments(id, PAGE_SIZE, offset, sortBy)
            : await chapterApi.getComments(id, PAGE_SIZE, offset);
        if (!Array.isArray(data?.comments)) return;

        const total = (data as { total?: number }).total;
        setComments((prev) => (offset === 0 ? data.comments : [...prev, ...data.comments]));
        setHasMore(
          data.comments.length === PAGE_SIZE && (typeof total === 'number' ? offset + data.comments.length < total : true),
        );
      } catch (err) {
        console.error(`Unable to load ${type} comments:`, err);
      } finally {
        setIsLoading(false);
      }
    },
    // `user?.id`: logging in or out re-fetches, so "my reaction" and "my comment" are right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, type, sortBy, user?.id],
  );

  const reload = useCallback(() => fetchPage(0), [fetchPage]);

  useEffect(() => {
    setHasMore(false);
    reload();
  }, [reload]);

  // Load the linked comment (e.g. from a notification) and scroll it into view.
  // A 404 includes a comment whose author the viewer blocked.
  const loadTarget = useCallback(() => {
    if (!targetId) return setTargetComment(null);
    commentApi
      .getDetail(targetId)
      .then((res) => setTargetComment(res?.comment ?? null))
      .catch((err) => {
        setTargetComment(null);
        console.warn('Unable to load linked comment:', err);
      });
  }, [targetId]);

  useEffect(() => {
    setTargetComment(null);
    loadTarget();
  }, [loadTarget]);

  useEffect(() => {
    if (!targetComment) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`cm-${targetComment.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [targetComment]);

  const requireAuth = useCallback(() => setIsAuthOpen(true), []);

  const actions: CommentActions = useMemo(
    () => ({
      reply: async (parentId, text) => {
        await api.createComment(id, text, parentId);
        await reload();
      },
      // Reactions update optimistically inside CommentItem; no reload needed.
      react: (commentId: string, reaction: Reaction) => api.reactComment(commentId, reaction).then(() => undefined),
      edit: async (commentId, text) => {
        await api.editComment(commentId, text);
        await reload();
      },
      remove: async (commentId) => {
        await api.deleteComment(commentId);
        await reload();
      },
      // The server leaves the blocked user's comments out from now on, so reloading hides them.
      block: async (userId) => {
        await userApi.blockUser(userId);
        loadTarget();
        await reload();
      },
      requireAuth,
    }),
    [api, id, reload, loadTarget, requireAuth],
  );

  const visibleComments = useMemo(
    () => comments.filter((c) => c.id !== targetComment?.id).sort(SORTERS[sortBy]),
    [comments, sortBy, targetComment],
  );

  const createComment = async (text: string) => {
    if (!isLoggedIn) return requireAuth();
    await api.createComment(id, text);
    await reload();
  };

  const itemProps = { actions, isLoggedIn, currentUserId: user?.id, currentUserName, targetId };
  const count = comments.length + (targetComment && !comments.some((c) => c.id === targetComment.id) ? 1 : 0);

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <header className={styles.head}>
        <h2 id="comments-heading" className={styles.title}>
          <MessageSquare size={18} />
          Discussion
          <span className={styles.count}>{count}</span>
        </h2>

        <div className={styles.sort} role="group" aria-label="Sort comments">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cx(styles.sortBtn, sortBy === s.id && styles.sortBtnOn)}
              aria-pressed={sortBy === s.id}
              onClick={() => setSortBy(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.composer}>
        <Avatar name={isLoggedIn ? currentUserName : '?'} size={36} />
        {isLoggedIn ? (
          <div className={styles.itemMain}>
            <CommentEditor placeholder="Share your thoughts…" submitLabel="Post" onSubmit={createComment} />
          </div>
        ) : (
          <div className={styles.signIn}>
            <span>Sign in to join the discussion.</span>
            <button type="button" className="btn btn--primary btn--sm" onClick={requireAuth}>
              Sign in
            </button>
          </div>
        )}
      </div>

      <ul className={styles.list}>
        {targetComment ? <CommentItem comment={targetComment} {...itemProps} /> : null}
        {visibleComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} {...itemProps} />
        ))}
      </ul>

      {!isLoading && visibleComments.length === 0 && !targetComment ? (
        <div className="empty-state">
          <strong>No comments yet</strong>
          Be the first to start the conversation.
        </div>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          className={cx('btn btn--ghost', styles.loadMore)}
          onClick={() => fetchPage(comments.length)}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Load more comments'}
        </button>
      ) : null}

      <AuthModalLayout isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </section>
  );
}
