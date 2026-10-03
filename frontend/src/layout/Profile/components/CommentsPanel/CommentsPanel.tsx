import { useState, useEffect } from 'react';
import { comicApi } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { MessageSquare, ThumbsUp, ThumbsDown, Reply } from 'lucide-react';
import { getImage } from '../../../../helpers/getImage';
import style from './CommentsPanel.module.css';

interface UserComment {
  id: string;
  content: string;
  createdAt: string;
  likes?: number;
  dislikes?: number;
  targetName?: string;
  targetUrl?: string;
  targetCoverUrl?: string | null;
  type?: 'comic' | 'chapter';
  replyCount?: number;
}

export default function CommentsPanel() {
  const [comments, setComments] = useState<UserComment[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'most-liked' | 'most-replies'>('recent');
  const [loading, setLoading] = useState(true);
  useAuth();

  useEffect(() => {
    fetchUserComments();
  }, [sortBy]);

  const fetchUserComments = async () => {
    setLoading(true);
    try {
      const data = await comicApi.getUserComments(sortBy);
      setComments(data);
    } catch (err) {
      console.error('Error fetching user comments:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={style['user-content']}>
      <div className={style['uview']}>
        <div className={`${style['uview__head']} ${style['uview__head--row']}`}>
          <div>
            <h2 className={style['uview__title']}>Comments</h2>
            <p className={style['uview__sub']}>{comments.length} comments you've posted.</p>
          </div>
          <div className={style['uview__head-tools']}>
            <div className={style['useg']}>
              <button 
                className={`${style['useg__btn']} ${sortBy === 'recent' ? style['is-on'] || 'is-on' : ''}`}
                onClick={() => setSortBy('recent')}
              >
                Recent
              </button>
              <button 
                className={`${style['useg__btn']} ${sortBy === 'most-liked' ? style['is-on'] || 'is-on' : ''}`}
                onClick={() => setSortBy('most-liked')}
              >
                Most liked
              </button>
              <button 
                className={`${style['useg__btn']} ${sortBy === 'most-replies' ? style['is-on'] || 'is-on' : ''}`}
                onClick={() => setSortBy('most-replies')}
              >
                Most replies
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading comments...</div>
        ) : comments.length > 0 ? (
          <ul className={style['clist']}>
            {comments.map((comment) => (
              <li className={style['crow']} key={comment.id}>
                <a 
                  className={style['crow__poster']} 
                  href={`/comics/${comment.targetUrl}?cm_id=${comment.id}`} 
                  aria-label={comment.targetName}
                >
                  <div className={`${style['poster']} ${style['poster--sm']}`}>
                    <img alt="" loading="lazy" src={getImage(comment.targetCoverUrl ?? undefined)} />
                  </div>
                </a>
                <div className={style['crow__body']}>
                  <div className={style['crow__head']}>
                    <a className={style['crow__title']} href={`/comics/${comment.targetUrl}?cm_id=${comment.id}`}>
                      {comment.targetName}
                    </a>
                  </div>
                  <div className={style['crow__content']}>{comment.content}</div>
                  <div className={style['crow__meta']}>
                    <span className={style['crow__time']}>
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                    <span className={style['crow__sep']} aria-hidden="true">·</span>
                    <span className={style['crow__stat']}>
                      <ThumbsUp size={11} strokeWidth={1.8} aria-hidden="true" /> {comment.likes}
                    </span>
                    <span className={style['crow__sep']} aria-hidden="true">·</span>
                    <span className={style['crow__stat']}>
                      <ThumbsDown size={11} strokeWidth={1.8} aria-hidden="true" /> {comment.dislikes}
                    </span>
                    <span className={style['crow__sep']} aria-hidden="true">·</span>
                    <span className={style['crow__stat']}>
                      <Reply size={11} strokeWidth={1.8} aria-hidden="true" /> {comment.replyCount}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={style['uempty']}>
            <div className={style['uempty__icon']}>
              <MessageSquare size={24} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className={style['uempty__title']}>No comments yet.</div>
            <div className={style['uempty__sub']}>Comments you post on chapters will appear here.</div>
          </div>
        )}
      </div>
    </div>
  );
}