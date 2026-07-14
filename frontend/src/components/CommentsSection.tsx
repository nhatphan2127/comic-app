//src/components/CommentsSection.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { comicApi, chapterApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../layout/AuthModal';
import type { Comment } from '../types/types';
import '../assets/styles/CommentSection.css';
import getAvatarBg from '../helpers/getAvatarBg';


// ─── COMPONENT CON: RECURSIVE COMMENT NODE ───
interface CommentNodeProps {
  comment: Comment;
  depth?: number;
  onReplySubmit: (parentId: string, text: string) => Promise<void>;
  onReact: (commentId: string, reaction: 'like' | 'dislike' | 'none') => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  canInteract: boolean;
  onRequireAuth: () => void;
  currentUserId?: string;
}

function CommentNode({ comment, depth = 0, onReplySubmit, onReact, onDelete, canInteract, onRequireAuth, currentUserId }: CommentNodeProps) {
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

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      try {
        await onDelete(comment.id);
      } catch (err) {
        console.error('Lỗi khi xóa bình luận:', err);
      }
    }
  };

  useEffect(() => {
    setCurrentReaction(comment.userReaction || 'none');
    setLikeCount(comment.like || 0);
    setDislikeCount(comment.dislike || 0);
  }, [comment.userReaction, comment.like, comment.dislike]);

  const handleReplyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSending || !canInteract) {
      if (!canInteract) {
        onRequireAuth();
      }
      return;
    }

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
    if (!canInteract) {
      onRequireAuth();
      return;
    }

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

  const isDeleted = !comment.content || comment.content.trim() === '';

  return (
    <li className={`cm-item ${hasReplies ? 'cm-item--has-replies' : ''} ${isDeleted ? 'cm-item--highlight' : ''}`} id={`cm-${comment.id}`}>
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
                {isDeleted ? (
                  <em>This comment has been deleted.</em>
                ) : (
                  comment.content
                )}
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
                  onClick={() => {
                    if (!canInteract) {
                      onRequireAuth();
                      return;
                    }
                    setIsReplying(!isReplying);
                  }}
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
                      {currentUserId === (comment.user?.id || comment.userId) && !isDeleted && (
                        <>
                          <button type="button" className="fdrop__item" role="menuitem" onClick={() => alert('Edit function coming soon')}>
                            Edit
                          </button>
                          <button type="button" className="fdrop__item" role="menuitem" onClick={handleDelete}>
                            Delete
                          </button>
                        </>
                      )}
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
            <CommentNode key={child.id} comment={child} depth={depth + 1} onReplySubmit={onReplySubmit} onReact={onReact} onDelete={onDelete} canInteract={canInteract} onRequireAuth={onRequireAuth} currentUserId={currentUserId} />
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
  const [sortBy, setSortBy] = useState<'best' | 'newest' | 'oldest'>('best');
  const [visibleCount, setVisibleCount] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { isLoggedIn, user } = useAuth();
  const activeId = targetId || comicId || '';
  const username = user?.displayName || user?.userName || 'ReaderPro';

  const fetchComments = async (currentSort: 'best' | 'newest' | 'oldest' = sortBy, reset = true, offsetValue = 0) => {
    if (!activeId) return;

    setIsLoading(true);
    try {
      const limit = 10;
      const offset = reset ? 0 : offsetValue;
      const data = type === 'comic'
        ? await comicApi.getComments(activeId, limit, offset, currentSort)
        : await chapterApi.getComments(activeId, limit, offset);

      if (data && Array.isArray(data.comments)) {
        const total = typeof (data as { total?: number }).total === 'number' ? (data as { total?: number }).total : 0;
        setCommentsList((prev) => reset ? data.comments : [...prev, ...data.comments]);
        setHasMore((data.comments?.length || 0) === limit && (total ? offset + data.comments.length < total : true));
      }
    } catch (err) {
      console.error(`Lỗi tải bình luận (${type}):`, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setVisibleCount(10);
    setHasMore(false);
    void fetchComments(sortBy, true, 0);
  }, [activeId, type, sortBy]);

  const handleCommentSubmitLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !activeId) return;
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      if (type === 'comic') {
        await comicApi.createComment(activeId, comment);
      } else {
        await chapterApi.createComment(activeId, comment);
      }
      setComment('');
      await fetchComments(sortBy, true, 0);
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
      await fetchComments(sortBy, true, 0);
    } catch (err) {
      console.error('Không thể gửi phản hồi:', err);
      throw err;
    }
  };

  const handleReaction = async (commentId: string, reaction: 'like' | 'dislike' | 'none') => {
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      throw new Error('Please log in to react.');
    }
    if (type === 'comic') {
      await comicApi.reactComment(commentId, reaction);
    } else {
      await chapterApi.reactComment(commentId, reaction);
    }
    await fetchComments(sortBy, true, 0);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (type === 'comic') {
      await comicApi.deleteComment(commentId);
    } else {
      await chapterApi.deleteComment(commentId);
    }
    await fetchComments(sortBy, true, 0);
  };

  const handleLoadMore = async () => {
    if (isLoading || !hasMore) return;
    const nextOffset = visibleCount;
    setVisibleCount(nextOffset + 10);
    await fetchComments(sortBy, false, nextOffset);
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
          {isLoggedIn ? (
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
          ) : (
            <div className="cm-item__detail" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' }}>
              <p style={{ margin: 0, opacity: 0.8 }}>Please sign in to join the discussion.</p>
              <button type="button" className="ubtn ubtn--primary" style={{ width: 'fit-content' }} onClick={() => setIsAuthModalOpen(true)}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Danh sách bình luận */}
      <ul className="cm-items">
        {sortedComments.map((comment) => (
          <CommentNode key={comment.id} comment={comment} depth={0} onReplySubmit={handleReplySubmit} onReact={handleReaction} onDelete={handleDeleteComment} canInteract={isLoggedIn} onRequireAuth={() => setIsAuthModalOpen(true)} currentUserId={user?.id} />
        ))}

        {sortedComments.length === 0 && (
          <li className="cm-item" style={{ padding: '24px', textAlign: 'center', opacity: 0.7 }}>
            No comments yet. Start the conversation!
          </li>
        )}
      </ul>

      {/* Chân trang tải thêm */}
      {hasMore && (
        <div className="cm-foot">
          <button type="button" className="ubtn ubtn--soft cm-foot__btn" onClick={handleLoadMore} disabled={isLoading}>
            <span>{isLoading ? 'Loading…' : 'Load more comments'}</span>
          </button>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </section>
  );
}
