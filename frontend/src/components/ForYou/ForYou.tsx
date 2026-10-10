import { useEffect, useState } from 'react';
import { getContentRatingValues, userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useContentFilter from '../../hooks/useContentFilter';
import type { Comic } from '../../types/types';
import ComicShelf from '../ComicShelf/ComicShelf';

const MAX_ITEMS = 20;
// Long enough to read a page of titles before the next one slides in.
const AUTO_SCROLL_MS = 6000;

/** "You might like": recommendations for logged-in readers on the home page. */
interface ForYouProps {
  className?: string;
  /** See ComicShelf: size the cards like a grid of this width. */
  cardLayoutWidth?: number;
}

export default function ForYou({ className, cardLayoutWidth }: ForYouProps) {
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
      headingId="you-might-like-heading"
      title="You might like"
      subtitle="Based on what you read, follow and rate"
      comics={comics}
      isLoading={isLoading}
      className={className}
      cardLayoutWidth={cardLayoutWidth}
      autoScrollMs={AUTO_SCROLL_MS}
    />
  );
}
