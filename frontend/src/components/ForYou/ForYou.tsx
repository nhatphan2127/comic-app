import { useEffect, useState } from 'react';
import { getContentRatingValues, userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useContentFilter from '../../hooks/useContentFilter';
import type { Comic } from '../../types/types';
import ComicShelf from '../ComicShelf/ComicShelf';

const MAX_ITEMS = 20;

function reasonText(comic: Comic) {
  const reason = comic.reason;
  switch (reason?.type) {
    case 'similar_readers':
      return `Liked by ${reason.count} readers like you`;
    case 'because_you_liked':
      return (
        <>
          Because you liked <strong>{reason.comic.name}</strong>
        </>
      );
    case 'trending':
      return 'Trending this week';
    default:
      return null;
  }
}

/** "For you": recommendations for logged-in readers on the home page, each with why it is there. */
export default function ForYou({ className }: { className?: string }) {
  const { isLoggedIn } = useAuth();
  const contentFilter = useContentFilter();
  const [comics, setComics] = useState<Comic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setComics([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    userApi
      .getRecommendations(MAX_ITEMS)
      .then((data) => {
        if (cancelled) return;
        // The server uses the account's filter; this also covers a change it has not saved yet.
        const allowed = getContentRatingValues(contentFilter);
        setComics((data || []).filter((comic) => !comic.contentRating || allowed.includes(comic.contentRating.toLowerCase())));
      })
      .catch(() => !cancelled && setComics([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, contentFilter]);

  if (!isLoggedIn || (!isLoading && comics.length === 0)) return null;

  return (
    <ComicShelf
      headingId="for-you-heading"
      title="For you"
      subtitle="Picked from what you read, follow and rate"
      comics={comics}
      caption={reasonText}
      isLoading={isLoading}
      className={className}
    />
  );
}
