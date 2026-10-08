import {
  CONTENT_RATING_OPTIONS,
  DEMOGRAPHIC_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '../../constants/comicOptions';
import type { ComicDetail } from '../../types/types';
import { formatDisplayValue } from '../../helpers/utils';
import { resolveUploadUrl } from '../../helpers/getImage';

export interface ComicFormValues {
  name: string;
  url: string;
  source: string;
  description: string;
  type: string;
  demographic: string;
  contentRating: string;
  releaseStatus: string;
  releasingYear: number;
  author: string;
  artist: string;
  genres: string[];
  formats: string[];
  cover: File | null;
  coverPreview: string | null;
}

export const emptyComicForm = (): ComicFormValues => ({
  name: '',
  url: '',
  source: '',
  description: '',
  type: '',
  demographic: '',
  contentRating: '',
  releaseStatus: '',
  releasingYear: new Date().getFullYear(),
  author: '',
  artist: '',
  genres: [],
  formats: [],
  cover: null,
  coverPreview: null,
});

/** Maps an API comic into form values (with display-cased option values). */
export const comicToForm = (comic: ComicDetail): ComicFormValues => ({
  name: comic.name || '',
  url: comic.url || '',
  source: comic.source || '',
  description: comic.description || '',
  type: formatDisplayValue(comic.types, [...TYPE_OPTIONS]),
  demographic: formatDisplayValue(comic.demographic, [...DEMOGRAPHIC_OPTIONS]),
  contentRating: formatDisplayValue(comic.contentRating, [...CONTENT_RATING_OPTIONS]),
  releaseStatus: formatDisplayValue(comic.releaseStatus, [...STATUS_OPTIONS]),
  releasingYear: Number(comic.releasingYear) || new Date().getFullYear(),
  author: comic.author || '',
  artist: comic.artist || '',
  genres: comic.genres ?? [],
  formats: comic.formats ?? [],
  cover: null,
  coverPreview: resolveUploadUrl(comic.coverUrl),
});
