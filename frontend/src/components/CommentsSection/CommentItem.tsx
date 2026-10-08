import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, MoreHorizontal, Reply, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Comment } from '../../types/types';
import { formatTimeAgo, parseServerDate } from '../../helpers/formatDate';
import useClickOutside from '../../hooks/useClickOutside';
import { useToast } from '../../context/ToastContext';
import Avatar from '../Avatar/Avatar';
import ReportDialog from '../ReportDialog/ReportDialog';
import CommentEditor from './CommentEditor';
import { renderMarkdown } from './markdown';
import cx from '../../helpers/cx';
import styles from './CommentsSection.module.css';

export type Reaction = 'like' | 'dislike' | 'none';

export interface CommentActions {
  reply: (parentId: string, text: string) => Promise<void>;
  react: (commentId: string, reaction: Reaction) => Promise<void>;
  edit: (commentId: string, text: string) => Promise<void>;
  remove: (commentId: string) => Promise<void>;
  requireAuth: () => void;
}

interface CommentItemProps {
  comment: Comment;
  actions: CommentActions;
  isLoggedIn: boolean;
  currentUserId?: string;
  currentUserName: string;
  targetId?: string;
}

/** Applies a reaction change to like/dislike counts. */
function nextCounts(prev: Reaction, next: Reaction, like: number, dislike: number) {
  return {
    like: like - (prev === 'like' ? 1 : 0) + (next === 'like' ? 1 : 0),
    dislike: dislike - (prev === 'dislike' ? 1 : 0) + (next === 'dislike' ? 1 : 0),
  };
}

export default function CommentItem(props: CommentItemProps) {
  const { comment, actions, isLoggedIn, currentUserId, currentUserName, targetId } = props;

  const authorName = comment.displayName || comment.user?.displayName || 'Guest';
  const authorAvatar = comment.avatar || comment.user?.avatar;
  const replies = comment.childComment ?? [];
  const isDeleted = !comment.content?.trim();
  const isEdited = Boolean(comment.updatedAt && comment.updatedAt !== comment.createdAt);
  const authorId = comment.user?.id || comment.userId;
  const isOwn = Boolean(currentUserId) && currentUserId === authorId;

  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(comment.userReaction || 'none');
  const [counts, setCounts] = useState({ like: comment.like || 0, dislike: comment.dislike || 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  useEffect(() => {
    setReaction(comment.userReaction || 'none');
    setCounts({ like: comment.like || 0, dislike: comment.dislike || 0 });
  }, [comment.userReaction, comment.like, comment.dislike]);

  const react = async (kind: 'like' | 'dislike') => {
    if (!isLoggedIn) return actions.requireAuth();
    const next: Reaction = reaction === kind ? 'none' : kind;
    const prev = { reaction, counts };

    // Optimistic update, rolled back on failure.
    setReaction(next);
    setCounts(nextCounts(reaction, next, counts.like, counts.dislike));
    try {
      await actions.react(comment.id, next);
    } catch (err) {
      toast.error(err, 'Could not save your reaction.');
      setReaction(prev.reaction);
      setCounts(prev.counts);
    }
  };

  const remove = async () => {
    setMenuOpen(false);
    if (!window.confirm('Delete this comment?')) return;
    try {
      await actions.remove(comment.id);
    } catch (err) {
      toast.error(err, 'Could not delete the comment.');
    }
  };

  return (
    <li id={`cm-${comment.id}`} className={cx(styles.item, comment.id === targetId && styles.itemTarget)}>
      <div className={styles.itemRow}>
        <Link to={`/users/${authorId}`} aria-label={`${authorName}'s profile`} tabIndex={-1}>
          <Avatar name={authorName} src={authorAvatar} size={36} />
        </Link>

        <div className={styles.itemMain}>
          <header className={styles.itemHead}>
            <Link to={`/users/${authorId}`} className={styles.author}>
              {authorName}
            </Link>
            <time className={styles.time} dateTime={comment.createdAt} title={parseServerDate(comment.createdAt).toLocaleString()}>
              {formatTimeAgo(comment.createdAt)}
              {isEdited && !isDeleted ? ' · edited' : ''}
            </time>
            <button
              type="button"
              className={styles.collapse}
              aria-label={collapsed ? 'Expand comment' : 'Collapse comment'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          </header>

          {!collapsed ? (
            <>
              {editing ? (
                <CommentEditor
                  placeholder="Edit your comment…"
                  submitLabel="Save"
                  initialValue={comment.content}
                  autoFocus
                  onCancel={() => setEditing(false)}
                  onSubmit={async (text) => {
                    await actions.edit(comment.id, text);
                    setEditing(false);
                  }}
                />
              ) : (
                <div className={cx(styles.content, isDeleted && styles.deleted)}>
                  {isDeleted ? 'This comment has been deleted.' : renderMarkdown(comment.content)}
                </div>
              )}

              <div className={styles.controls}>
                <button
                  type="button"
                  className={cx(styles.ctrl, reaction === 'like' && styles.ctrlLike)}
                  aria-pressed={reaction === 'like'}
                  aria-label="Like"
                  onClick={() => react('like')}
                >
                  <ThumbsUp size={14} />
                  {counts.like}
                </button>
                <button
                  type="button"
                  className={cx(styles.ctrl, reaction === 'dislike' && styles.ctrlDislike)}
                  aria-pressed={reaction === 'dislike'}
                  aria-label="Dislike"
                  onClick={() => react('dislike')}
                >
                  <ThumbsDown size={14} />
                  {counts.dislike}
                </button>
                <button
                  type="button"
                  className={cx(styles.ctrl, replying && styles.ctrlOn)}
                  aria-expanded={replying}
                  onClick={() => (isLoggedIn ? setReplying((v) => !v) : actions.requireAuth())}
                >
                  <Reply size={14} />
                  Reply
                </button>

                <div className={styles.menuWrap} ref={menuRef}>
                  <button
                    type="button"
                    className={cx(styles.ctrl, menuOpen && styles.ctrlOn)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="More actions"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen ? (
                    <div className={styles.menu} role="menu">
                      {isOwn ? (
                        <>
                          {!isDeleted ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                setEditing(true);
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button type="button" role="menuitem" className={styles.menuDanger} onClick={remove}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            if (isLoggedIn) setReporting(true);
                            else actions.requireAuth();
                          }}
                        >
                          Report
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {!collapsed && (replying || replies.length > 0) ? (
        <ul className={styles.replies}>
          {replying ? (
            <li className={cx(styles.item, styles.itemRow)}>
              <Avatar name={currentUserName} size={36} />
              <div className={styles.itemMain}>
                <CommentEditor
                  placeholder={`Reply to ${authorName}…`}
                  submitLabel="Reply"
                  autoFocus
                  onCancel={() => setReplying(false)}
                  onSubmit={async (text) => {
                    await actions.reply(comment.id, text);
                    setReplying(false);
                  }}
                />
              </div>
            </li>
          ) : null}
          {replies.map((child) => (
            <CommentItem key={child.id} {...props} comment={child} />
          ))}
        </ul>
      ) : null}

      {reporting ? (
        <ReportDialog isOpen onClose={() => setReporting(false)} targetType="comment" targetId={comment.id} targetLabel={`Comment by ${authorName}`} />
      ) : null}
    </li>
  );
}
