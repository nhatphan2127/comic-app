// Comic metadata vocabularies shared by forms, filters and moderation views.

export const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'] as const;
export const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'] as const;
export const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'] as const;
export const CONTENT_RATING_OPTIONS = ['Safe', 'Suggestive', 'Erotica', 'Pornographic'] as const;

export const GENRE_OPTIONS = [
  'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi',
  'Fantasy', 'Girls Love', 'Harem', 'Hentai', 'Historical', 'Horror', 'Isekai',
  'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports',
  'Superhero', 'Thriller', 'Tragedy', 'Wuxia',
] as const;

export const FORMAT_OPTIONS = [
  '4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi',
  'Full Color', 'Long Strip', 'Oneshot', 'Web Comic',
] as const;
