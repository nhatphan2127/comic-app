import { useState, useEffect } from 'react';
import { comicApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MessageSquare, ThumbsUp, ThumbsDown, Reply } from 'lucide-react';
import { getImage } from '../../../helpers/getImage';

interface UserComment {
  id: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  targetName: string;
  targetUrl: string;
  targetCoverUrl: string;
  type: 'comic' | 'chapter';
  replyCount: number;
}

export default function CommentsPanel() {
  const [comments, setComments] = useState<UserComment[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'most-liked' | 'most-replies'>('recent');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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
    <div className="user-content">
      <div className="uview">
        <div className="uview__head uview__head--row">
          <div>
            <h2 className="uview__title">Comments</h2>
            <p className="uview__sub">{comments.length} comments you've posted.</p>
          </div>
          <div className="uview__head-tools">
            <div className="useg">
              <button 
                className={`useg__btn ${sortBy === 'recent' ? 'is-on' : ''}`}
                onClick={() => setSortBy('recent')}
              >
                Recent
              </button>
              <button 
                className={`useg__btn ${sortBy === 'most-liked' ? 'is-on' : ''}`}
                onClick={() => setSortBy('most-liked')}
              >
                Most liked
              </button>
              <button 
                className={`useg__btn ${sortBy === 'most-replies' ? 'is-on' : ''}`}
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
          <ul className="clist">
            {comments.map((comment) => (
              <li className="crow" key={comment.id}>
                <a 
                  className="crow__poster" 
                  href={`/title/${comment.targetUrl}?cm_id=${comment.id}`} 
                  aria-label={comment.targetName}
                >
                  <div className="poster poster--sm">
                    <img alt="" loading="lazy" src={getImage(comment.targetCoverUrl)} />
                  </div>
                </a>
                <div className="crow__body">
                  <div className="crow__head">
                    <a className="crow__title" href={`/title/${comment.targetUrl}?cm_id=${comment.id}`}>
                      {comment.targetName}
                    </a>
                  </div>
                  <div className="crow__content">{comment.content}</div>
                  <div className="crow__meta">
                    <span className="crow__time">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                    <span className="crow__sep" aria-hidden="true">·</span>
                    <span className="crow__stat">
                      <ThumbsUp size={11} strokeWidth={1.8} aria-hidden="true" /> {comment.likes}
                    </span>
                    <span className="crow__sep" aria-hidden="true">·</span>
                    <span className="crow__stat">
                      <ThumbsDown size={11} strokeWidth={1.8} aria-hidden="true" /> {comment.dislikes}
                    </span>
                    <span className="crow__sep" aria-hidden="true">·</span>
                    <span className="crow__stat">
                      <Reply size={11} strokeWidth={1.8} aria-hidden="true" /> {comment.replyCount}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="uempty">
            <div className="uempty__icon">
              <MessageSquare size={24} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="uempty__title">No comments yet.</div>
            <div className="uempty__sub">Comments you post on chapters will appear here.</div>
          </div>
        )}
      </div>
    </div>
  );
}
