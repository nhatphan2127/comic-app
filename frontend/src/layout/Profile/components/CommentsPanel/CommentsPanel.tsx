import { useEffect, useState } from 'react';
import { comicApi } from '../../../../services/api';
import type { UserComment } from '../../../../types/types';
import UserCommentList from '../../../../components/UserCommentList/UserCommentList';
import Segmented from '../../../../components/Segmented/Segmented';
import PanelShell, { PanelState } from '../PanelShell/PanelShell';

type SortBy = 'recent' | 'most-liked' | 'most-replies';

export default function CommentsPanel() {
  const [comments, setComments] = useState<UserComment[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    comicApi
      .getUserComments(sortBy)
      .then((data) => !cancelled && setComments(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load comments'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sortBy]);

  return (
    <PanelShell
      title="Comments"
      subtitle={`${comments.length} comments you've posted`}
      actions={
        <Segmented
          ariaLabel="Sort comments"
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'most-liked', label: 'Most liked' },
            { value: 'most-replies', label: 'Most replies' },
          ]}
        />
      }
    >
      <PanelState
        loading={loading}
        error={error}
        empty={comments.length === 0}
        emptyTitle="No comments yet"
        emptyText="Comments you post on comics and chapters will appear here."
      >
        <UserCommentList comments={comments} />
      </PanelState>
    </PanelShell>
  );
}
