import { MessageSquare } from 'lucide-react';

export default function CommentsPanel() {
  return (
    <div className="panel-container">
      <h2 className="panel-title">Comments</h2>
      <p className="panel-subtitle">0 comments you've posted.</p>

      <div className="empty-state-container">
        <MessageSquare className="empty-state-icon" strokeWidth={1.6} />
        <h3>No comments yet.</h3>
        <p>Comments you post on chapters will appear here.</p>
      </div>
    </div>
  );
}