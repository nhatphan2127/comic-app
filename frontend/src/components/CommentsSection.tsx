//src/components/CommentsSection.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { comicApi, chapterApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Comment } from '../types/data';
import '../assets/styles/CommentSection.css';

// Hàm helper sinh màu nền avatar ngẫu nhiên dựa trên tên người dùng (tương tự như Comick)
const getAvatarBg = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = (hash & 0xFF0000) >> 16;
  const g = (hash & 0x00FF00) >> 8;
  const b = hash & 0x0000FF;
  return `rgb(${Math.abs(r) % 150 + 50}, ${Math.abs(g) % 150 + 50}, ${Math.abs(b) % 150 + 50})`;
};

// ─── COMPONENT CON: RECURSIVE COMMENT NODE ───
interface CommentNodeProps {
  comment: Comment;
  depth?: number;
  onReplySubmit: (parentId: string, text: string) => Promise<void>;
  onReact: (commentId: string, reaction: 'like' | 'dislike' | 'none') => Promise<void>;
}

function CommentNode({ comment, depth = 0, onReplySubmit, onReact }: CommentNodeProps) {
  const formattedDate = comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : '';
  const userAvatar = comment.avatar || comment.user?.avatar;
  const userName = comment.displayName || comment.user?.displayName || 'Khách';
  const hasReplies = comment.childCommment && comment.childCommment.length > 0;

  // ─── TRẠNG THÁI HOẠT ĐỘNG (INTERACTIVE STATE) ───
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isReplying, setIsReplying] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [currentReaction, setCurrentReaction] = useState<'like' | 'dislike' | 'none'>(comment.userReaction || 'none');
  const [likeCount, setLikeCount] = useState<number>(comment.like || 0);
  const [dislikeCount, setDislikeCount] = useState<number>(comment.dislike || 0);

  // Đóng trình đơn hành động khi click ra ngoài
  useEffect(() => {
    if (!isMenuOpen) return;
    const closeMenu = () => setIsMenuOpen(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [isMenuOpen]);

  const handleCopyLink = () => {
    const commentUrl = `${window.location.origin}${window.location.pathname}#cm-${comment.id}`;
    navigator.clipboard.writeText(commentUrl)
      .then(() => alert('Đã sao chép liên kết bình luận!'))
      .catch((err) => console.error('Không thể sao chép liên kết:', err));
  };

  useEffect(() => {
    setCurrentReaction(comment.userReaction || 'none');
    setLikeCount(comment.like || 0);
    setDislikeCount(comment.dislike || 0);
  }, [comment.userReaction, comment.like, comment.dislike]);

  const handleReplyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      await onReplySubmit(comment.id, replyText);
      setReplyText('');
      setIsReplying(false);
    } catch (err) {
      console.error('Lỗi khi gửi phản hồi:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReaction = async (reaction: 'like' | 'dislike') => {
    const nextReaction = currentReaction === reaction ? 'none' : reaction;
    try {
      await onReact(comment.id, nextReaction);
      setCurrentReaction(nextReaction);
      if (reaction === 'like') {
        setLikeCount((prev) => prev + (nextReaction === 'like' ? 1 : -1));
        if (currentReaction === 'dislike') {
          setDislikeCount((prev) => prev - 1);
        }
      } else {
        setDislikeCount((prev) => prev + (nextReaction === 'dislike' ? 1 : -1));
        if (currentReaction === 'like') {
          setLikeCount((prev) => prev - 1);
        }
      }
    } catch (err) {
      console.error('Không thể cập nhật phản ứng:', err);
    }
  };

  return (
    <li className={`cm-item ${hasReplies ? 'cm-item--has-replies' : ''}`} id={`cm-${comment.id}`}>
      <div className="cm-item__main">
        <a className="cm-item__avatar" href={`/u/${comment.user?.displayName || 'guest'}`} aria-label={userName}>
          {userAvatar ? (
            <span className="uavatar" aria-hidden="true" style={{ width: 32, height: 32 }}>
              <img src={userAvatar} alt={userName} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            </span>
          ) : (
            <span className="uavatar" aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: getAvatarBg(userName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
              {userName.charAt(0).toUpperCase()}
            </span>
          )}
        </a>
        <div className="cm-item__detail">
          <div className="cm-item__header">
            <div className="cm-item__header-main">
              <span className="cm-item__user">
                <a href={`/u/${comment.user?.displayName || 'guest'}`}>{userName}</a>
              </span>
              <span className="cm-item__time">{formattedDate}</span>
            </div>
            {/* Thu gọn / Mở rộng bình luận */}
            <span 
              className="cm-item__collapser" 
              role="button" 
              tabIndex={0} 
              aria-label={isCollapsed ? "Expand comment" : "Collapse comment"} 
              title={isCollapsed ? "Expand" : "Collapse"}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <i aria-hidden="true">{isCollapsed ? '+' : '−'}</i>
            </span>
          </div>

          {!isCollapsed && (
            <>
              <div className="cm-item__content content-rendered">
                {comment.content}
              </div>
              <div className="cm-item__ctrls">
                {/* Thích */}
                <button type="button" className={`cm-item__ctrl cm-item__ctrl--like ${currentReaction === 'like' ? 'cm-item__ctrl--active' : ''}`} aria-pressed={currentReaction === 'like'} aria-label="Like" onClick={() => handleReaction('like')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M7 10v12"></path>
                    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4-9h.5a2.5 2.5 0 0 1 2.5 2.88z"></path>
                  </svg>
                  <span>{likeCount}</span>
                </button>
                {/* Không thích */}
                <button type="button" className={`cm-item__ctrl cm-item__ctrl--dislike ${currentReaction === 'dislike' ? 'cm-item__ctrl--active' : ''}`} aria-pressed={currentReaction === 'dislike'} aria-label="Dislike" onClick={() => handleReaction('dislike')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17 14V2"></path>
                    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4 9h-.5a2.5 2.5 0 0 1-2.5-2.88z"></path>
                  </svg>
                  <span>{dislikeCount}</span>
                </button>
                {/* Phản hồi */}
                <button 
                  type="button" 
                  className={`cm-item__ctrl cm-item__ctrl--reply ${isReplying ? 'cm-item__ctrl--active' : ''}`} 
                  aria-expanded={isReplying ? "true" : "false"}
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <polyline points="9 17 4 12 9 7"></polyline>
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                  </svg>
                  <span>Reply</span>
                </button>

                {/* Dropdown Menu "More" */}
                <div className={`fdrop cm-item__menu ${isMenuOpen ? 'is-open' : ''}`}>
                  <button 
                    type="button" 
                    className={`cm-item__ctrl cm-item__ctrl--menu ${isMenuOpen ? 'cm-item__ctrl--active' : ''}`} 
                    aria-haspopup="menu" 
                    aria-expanded={isMenuOpen ? "true" : "false"} 
                    aria-label="More actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(!isMenuOpen);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="2"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                      <circle cx="19" cy="12" r="2"></circle>
                    </svg>
                    <span>More</span>
                  </button>
                  {isMenuOpen && (
                    <div className="fdrop__pop fdrop__pop--menu" role="menu">
                      <button type="button" className="fdrop__item" role="menuitem" onClick={() => alert('Đã báo cáo bình luận.')}>
                        Report
                      </button>
                      <button type="button" className="fdrop__item" role="menuitem" onClick={handleCopyLink}>
                        Copy link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hiển thị bình luận con hoặc Trình soạn thảo phản hồi */}
      {!isCollapsed && (hasReplies || isReplying) && (
        <ul className="cm-item__replies">
          {isReplying && (
            <li className="cm-item cm-item--editor">
              <div className="cm-item__main">
                <span className="cm-item__avatar" aria-hidden="true">
                  <span className="uavatar" aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: 'rgb(122, 82, 56)' }}>
                    R
                  </span>
                </span>
                <div className="cm-item__detail">
                  <form className="cm-editor" onSubmit={handleReplyFormSubmit}>
                    <textarea
                      className="input input--area cm-editor__input"
                      placeholder={`Reply to ${userName}…`}
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div style={{ height: 'auto', overflow: 'visible', transition: 'height 220ms' }}>
                      <div className="cm-editor__bar">
                        <div className="cm-editor__toolbar" role="toolbar" aria-label="Formatting">
                          <button type="button" className="cm-editor__tool" aria-label="Bold" title="Bold (Ctrl+B)">
                            <strong>B</strong>
                          </button>
                          <button type="button" className="cm-editor__tool" aria-label="Quote" title="Quote">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 7h4v4H8c0 2 0 3 2 4"></path>
                              <path d="M15 7h4v4h-3c0 2 0 3 2 4"></path>
                            </svg>
                          </button>
                          <button type="button" className="cm-editor__tool" aria-label="Spoiler" title="Spoiler (Ctrl+E)">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3l18 18"></path>
                              <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c7 0 11 7 11 7a17.6 17.6 0 0 1-3.2 4.4"></path>
                              <path d="M6.6 6.6A17.7 17.7 0 0 0 1 13s4 7 11 7a9.7 9.7 0 0 0 5.4-1.6"></path>
                              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
                            </svg>
                          </button>
                        </div>
                        <div className="cm-editor__actions">
                          <button type="button" className="ubtn ubtn--ghost" onClick={() => { setIsReplying(false); setReplyText(''); }}>
                            Cancel
                          </button>
                          <button type="submit" className="ubtn ubtn--primary" disabled={!replyText.trim() || isSending}>
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </li>
          )}

          {hasReplies && comment.childCommment!.map((child) => (
            <CommentNode key={child.id} comment={child} depth={depth + 1} onReplySubmit={onReplySubmit} onReact={onReact} />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── MAIN COMPONENT ───
interface CommentsSectionProps {
  comicId?: string;
  targetId?: string;
  type?: 'comic' | 'chapter';
}

export default function CommentsSection({ comicId, targetId, type = 'comic' }: CommentsSectionProps) {
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [comment, setComment] = useState<string>('');
  const [username] = useState<string>('ReaderPro');
  const [sortBy, setSortBy] = useState<'best' | 'newest' | 'oldest'>('best');
  const { isLoggedIn } = useAuth();
  const activeId = targetId || comicId || '';

  const fetchComments = async (currentSort: 'best' | 'newest' | 'oldest' = sortBy) => {
    if (!activeId) return;
    try {
      const data = type === 'comic'
        ? await comicApi.getComments(activeId, 20, 0, currentSort)
        : await chapterApi.getComments(activeId, 20, 0);
        
      if (data && data.comments) {
        setCommentsList(data.comments);
      }
    } catch (err) {
      console.error(`Lỗi tải bình luận (${type}):`, err);
    }
  };

  useEffect(() => {
    fetchComments(sortBy);
  }, [activeId, type, sortBy]);

  const handleCommentSubmitLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !activeId) return;
    if (!isLoggedIn) {
      alert('Please log in to comment.');
      return;
    }

    try {
      if (type === 'comic') {
        console.log({ activeId, comment })
        await comicApi.createComment(activeId, comment);
      } else {
        await chapterApi.createComment(activeId, comment);
      }
      setComment('');
      await fetchComments(sortBy);
    } catch (err) {
      console.error('Không thể gửi bình luận:', err);
    }
  };

  // Hàm xử lý gửi phản hồi (Reply) cho một bình luận có sẵn
  const handleReplySubmit = async (parentId: string, text: string) => {
    if (!activeId || !isLoggedIn) {
      throw new Error('Please log in to reply.');
    }
    try {
      if (type === 'comic') {
        await comicApi.createComment(activeId, text, parentId);
      } else {
        await chapterApi.createComment(activeId, text, parentId);
      }
      await fetchComments(sortBy);
    } catch (err) {
      console.error('Không thể gửi phản hồi:', err);
      throw err;
    }
  };

  const handleReaction = async (commentId: string, reaction: 'like' | 'dislike' | 'none') => {
    if (!isLoggedIn) {
      throw new Error('Please log in to react.');
    }
    if (type === 'comic') {
      await comicApi.reactComment(commentId, reaction);
    } else {
      await chapterApi.reactComment(commentId, reaction);
    }
    await fetchComments(sortBy);
  };

  const sortedComments = useMemo(() => {
    const list = [...commentsList];
    if (sortBy === 'newest') {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (sortBy === 'oldest') {
      return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return list.sort((a, b) => (b.like - b.dislike) - (a.like - a.dislike));
  }, [commentsList, sortBy]);

  return (
    <section className="cm-widget mpage__sec">
      {/* Header Widget */}
      <header className="cm-widget__head">
        <div className="cm-widget__title-row">
          <div className="cm-widget__title">{commentsList.length} comments</div>
        </div>
        <div className="useg cm-widget__sort">
          <button
            type="button"
            className={`useg__btn ${sortBy === 'best' ? 'is-on' : ''}`}
            onClick={() => setSortBy('best')}
          >
            Best
          </button>
          <button
            type="button"
            className={`useg__btn ${sortBy === 'newest' ? 'is-on' : ''}`}
            onClick={() => setSortBy('newest')}
          >
            Newest
          </button>
          <button
            type="button"
            className={`useg__btn ${sortBy === 'oldest' ? 'is-on' : ''}`}
            onClick={() => setSortBy('oldest')}
          >
            Oldest
          </button>
        </div>
      </header>

      {/* Form Editor chính */}
      <div className="cm-item cm-item--editor">
        <div className="cm-item__main">
          <span className="cm-item__avatar" aria-hidden="true">
            <span className="uavatar" aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: 'rgb(122, 82, 56)' }}>
              {username.charAt(0).toUpperCase()}
            </span>
          </span>
          <div className="cm-item__detail">
            <form className="cm-editor" onSubmit={handleCommentSubmitLocal}>
              <textarea
                className="input input--area cm-editor__input"
                placeholder="Share your thoughts about this series…"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div style={{ height: 'auto', overflow: 'visible', transition: 'height 220ms' }}>
                <div className="cm-editor__bar">
                  <div className="cm-editor__toolbar" role="toolbar" aria-label="Formatting">
                    <button type="button" className="cm-editor__tool" aria-label="Bold" title="Bold (Ctrl+B)">
                      <strong>B</strong>
                    </button>
                    <button type="button" className="cm-editor__tool" aria-label="Quote" title="Quote">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 7h4v4H8c0 2 0 3 2 4"></path>
                        <path d="M15 7h4v4h-3c0 2 0 3 2 4"></path>
                      </svg>
                    </button>
                    <button type="button" className="cm-editor__tool" aria-label="Spoiler" title="Spoiler (Ctrl+E)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18"></path>
                        <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c7 0 11 7 11 7a17.6 17.6 0 0 1-3.2 4.4"></path>
                        <path d="M6.6 6.6A17.7 17.7 0 0 0 1 13s4 7 11 7a9.7 9.7 0 0 0 5.4-1.6"></path>
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="cm-editor__actions">
                    <button type="button" className="ubtn ubtn--ghost" onClick={() => setComment('')}>
                      Cancel
                    </button>
                    <button type="submit" className="ubtn ubtn--primary" disabled={!comment.trim()}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Danh sách bình luận */}
      <ul className="cm-items">
        {sortedComments.map((comment) => (
          <CommentNode key={comment.id} comment={comment} depth={0} onReplySubmit={handleReplySubmit} onReact={handleReaction} />
        ))}

        {sortedComments.length === 0 && (
          <li className="cm-item" style={{ padding: '24px', textAlign: 'center', opacity: 0.7 }}>
            No comments yet. Start the conversation!
          </li>
        )}
      </ul>

      {/* Chân trang tải thêm */}
      {commentsList.length > 0 && (
        <div className="cm-foot">
          <button type="button" className="ubtn ubtn--soft cm-foot__btn">
            <span>Load more comments</span>
          </button>
        </div>
      )}
    </section>
  );
}
