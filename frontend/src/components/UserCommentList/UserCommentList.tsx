import { Link } from 'react-router-dom';
import { Reply, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { UserComment } from '../../types/types';
import { getImage } from '../../helpers/getImage';
import { formatTimeAgo } from '../../helpers/formatDate';
import Cover from '../Cover/Cover';
import style from './UserCommentList.module.css';

/** Link to the comment in its thread: on the comic page, or in the reader for chapter comments. */
const commentHref = (c: UserComment) =>
  c.type === 'chapter' && c.chapterId ? `/comics/${c.targetUrl}/${c.chapterId}?cm_id=${c.id}` : `/comics/${c.targetUrl}?cm_id=${c.id}`;

/** A user's comments with the comic each belongs to (own comments panel and public profiles). */
export default function UserCommentList({ comments }: { comments: UserComment[] }) {
  return (
    <ul className={style.list}>
      {comments.map((c) => {
        const href = commentHref(c);
        return (
          <li key={c.id} className={style.row}>
            <Link to={href} aria-label={c.targetName}>
              <Cover src={getImage(c.targetCoverUrl)} size="sm" />
            </Link>
            <div className={style.body}>
              <Link to={href} className={style.title}>
                {c.targetName}
              </Link>
              <p className={style.content}>{c.content}</p>
              <div className={style.meta}>
                <span>{formatTimeAgo(c.createdAt)}</span>
                <span className={style.stat}>
                  <ThumbsUp size={12} /> {c.likes ?? 0}
                </span>
                <span className={style.stat}>
                  <ThumbsDown size={12} /> {c.dislikes ?? 0}
                </span>
                <span className={style.stat}>
                  <Reply size={12} /> {c.replyCount ?? 0}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
