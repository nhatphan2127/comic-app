// src/services/api.ts
import type { Comment, Comic, UserFollowingCategory, UserProfile, FollowingComic, HistoryItem, Notification, ComicContributor, ChapterContributor, Chapter, DashboardResponse, Report, ReportStatus, ReportTargetType, UserRole, Preferences, PublicProfile, UserComment } from '../types/types';

export const API_ORIGIN = 'http://localhost:5000';
// Versioned REST API (see backend/docs/api-conventions.md). Interactive docs: http://localhost:5000/api/docs
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const API_UPLOADS = `${API_ORIGIN}/storage/`;
export type ContentFilter = 'Safe' | 'Suggestive' | 'Erotica' | 'Pornographic';
export const CONTENT_FILTER_STORAGE_KEY = 'comic-content-filter';
export const DEFAULT_CONTENT_FILTER: ContentFilter = 'Suggestive';

export interface ComicSearchResult {
  id: string;
  name: string;
  url: string;
  coverUrl: string | null;
  types?: string;
  rating?: number;
  latestChapter?: number | null;
}

export interface BrowseFilters {
  q?: string;
  type?: string;
  formats?: string[];
  demographic?: string;
  releaseStatus?: string;
  genres?: string[];
  sort?: string;
  page?: number;
  pageSize?: number;
}

export function getStoredContentFilter(): ContentFilter {
  if (typeof window === 'undefined') {
    return DEFAULT_CONTENT_FILTER;
  }

  const stored = window.localStorage.getItem(CONTENT_FILTER_STORAGE_KEY);
  const validValues: ContentFilter[] = ['Safe', 'Suggestive', 'Erotica', 'Pornographic'];
  return stored && validValues.includes(stored as ContentFilter) ? (stored as ContentFilter) : DEFAULT_CONTENT_FILTER;
}

export function setStoredContentFilter(filter: ContentFilter) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CONTENT_FILTER_STORAGE_KEY, filter);
  window.dispatchEvent(new Event('content-filter-changed'));
}

export function getContentRatingValues(filter: ContentFilter | string): string[] {
  switch (String(filter || '').toLowerCase()) {
    case 'safe':
      return ['safe'];
    case 'suggestive':
      return ['safe', 'suggestive'];
    case 'erotica':
      return ['safe', 'suggestive', 'erotica'];
    case 'pornographic':
      return ['safe', 'suggestive', 'erotica', 'pornographic'];
    default:
      return ['safe', 'suggestive'];
  }
}

// ---------------------------------------------------------------------------
// HTTP layer. The backend answers:
//   success        { data }  or  { data, meta } for a page of a collection
//   204            no body
//   errors         application/problem+json { type, title, status, detail, instance }
// ---------------------------------------------------------------------------

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function send<T>(path: string, init?: RequestInit): Promise<{ data: T; meta?: PageMeta }> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    // Our token was rejected (expired, logged out elsewhere, password reset): drop the local session.
    // Matched on the auth middleware's message, since other 401s (a wrong current password) keep the session.
    if (response.status === 401 && problem?.detail === 'Invalid or expired session token') {
      window.dispatchEvent(new Event('auth-expired'));
    }
    throw new ApiError(response.status, problem?.detail || problem?.title || `Request failed (${response.status})`);
  }
  if (response.status === 204) return { data: undefined as T };

  const payload = await response.json();
  return { data: payload.data as T, meta: payload.meta };
}

const jsonInit = (init?: RequestInit): RequestInit => ({
  ...init,
  headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
});

// JSON request → `data`.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await send<T>(path, jsonInit(init))).data;
}

// JSON request for a paginated collection → `{ data, meta }`.
async function requestPage<T>(path: string, init?: RequestInit): Promise<{ data: T[]; meta: PageMeta }> {
  const { data, meta } = await send<T[]>(path, jsonInit(init));
  return { data, meta: meta as PageMeta };
}

// Multipart upload (the browser sets the multipart Content-Type itself) → `data`.
async function multipartRequest<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  return (await send<T>(path, { ...init, body: formData })).data;
}

const query = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

const contentRatingParam = (contentFilter?: ContentFilter | string) =>
  getContentRatingValues(contentFilter ?? getStoredContentFilter()).join(',');

// Get authorization header with the session token from localStorage
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// The UI loads comments with limit/offset ("load more"); the API pages with page/pageSize.
const COMMENT_SORT = { best: '-score', newest: '-createdAt', oldest: 'createdAt' } as const;
type CommentSort = keyof typeof COMMENT_SORT;

async function listComments(kind: 'comics' | 'chapters', targetId: string, limit: number, offset: number, sortBy: CommentSort) {
  const page = Math.floor(offset / limit) + 1;
  const { data, meta } = await requestPage<Comment>(
    `/${kind}/${targetId}/comments${query({ page, pageSize: limit, sort: COMMENT_SORT[sortBy] })}`,
    { headers: getAuthHeaders() },
  );
  return { comments: data, total: meta.totalItems, sortBy };
}

// Single comments are addressed by id only, whatever they belong to.
const commentById = {
  react: (commentId: string, reactionType: 'like' | 'dislike' | 'none') =>
    reactionType === 'none'
      ? request<void>(`/comments/${commentId}/reaction`, { method: 'DELETE', headers: getAuthHeaders() })
      : request<{ likes: number; dislikes: number; userReaction: string }>(`/comments/${commentId}/reaction`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type: reactionType }),
      }),
  remove: (commentId: string) => request<void>(`/comments/${commentId}`, { method: 'DELETE', headers: getAuthHeaders() }),
  edit: (commentId: string, content: string) =>
    request<{ id: string; content: string }>(`/comments/${commentId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    }),
};

const postComment = (kind: 'comics' | 'chapters', targetId: string, content: string, parentCommentId?: string) =>
  request<Comment>(`/${kind}/${targetId}/comments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content, parentCommentId }),
  });

// Comic-related API endpoints
export const comicApi = {
  // use Main.tsx
  list: async (page?: number, contentFilter?: ContentFilter | string) => {
    const { data, meta } = await requestPage<Comic>(`/comics${query({ page, contentRating: contentRatingParam(contentFilter) })}`);
    return { comics: data, metadata: { page: meta.page, totalPages: meta.totalPages } };
  },

  // use Main.tsx
  getPopular: async (contentFilter?: ContentFilter | string) =>
    (await requestPage<Comic>(`/comics${query({ sort: '-view', pageSize: 10, contentRating: contentRatingParam(contentFilter) })}`)).data,

  // use HeroCarousel in MainLayout.tsx
  getTopRated: async (limit = 8, contentFilter?: ContentFilter | string) =>
    (await requestPage<Comic>(`/comics${query({ sort: '-rating,-view', pageSize: limit, contentRating: contentRatingParam(contentFilter) })}`)).data,

  // use BrowseLayout.tsx: every filter the catalogue supports, one page at a time
  browse: async (filters: BrowseFilters, contentFilter?: ContentFilter | string) => {
    const { data, meta } = await requestPage<Comic>(
      `/comics${query({
        q: filters.q,
        type: filters.type,
        demographic: filters.demographic,
        releaseStatus: filters.releaseStatus,
        genre: filters.genres?.join(','),
        format: filters.formats?.join(','),
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
        contentRating: contentRatingParam(contentFilter),
      })}`,
    );
    return { comics: data, meta };
  },

  search: async (q: string): Promise<ComicSearchResult[]> => {
    const { data } = await requestPage<Comic & { latestChapters?: Array<{ chapterNumber: number }> }>(`/comics${query({ q, pageSize: 6 })}`);
    return data.map((comic) => ({
      id: comic.id,
      name: comic.name ?? '',
      url: comic.url,
      coverUrl: comic.coverUrl,
      types: comic.types,
      rating: comic.rating,
      latestChapter: comic.latestChapters?.[0]?.chapterNumber ?? null,
    }));
  },

  // use MangaDetailLayout.tsx (accepts the url slug or the id)
  getByUrl: (url: string) => request<Comic>(`/comics/${url}`, { headers: getAuthHeaders() }),

  // use MangaDetailLayout.tsx: every chapter, paginated on the client
  getChaptersByUrl: async (url: string) => (await requestPage<Chapter>(`/comics/${url}/chapters?pageSize=1000`)).data,

  getComments: (comicId: string, limit: number, offset: number, sortBy: CommentSort = 'best') =>
    listComments('comics', comicId, limit, offset, sortBy),

  createComment: (comicId: string, content: string, parentCommentId?: string) => postComment('comics', comicId, content, parentCommentId),
  reactComment: commentById.react,
  deleteComment: commentById.remove,
  editComment: commentById.edit,

  getUserComments: async (sortBy: 'recent' | 'most-liked' | 'most-replies' = 'recent') => {
    const sort = { recent: '-createdAt', 'most-liked': '-likes', 'most-replies': '-replyCount' }[sortBy];
    return (await requestPage<UserComment>(`/me/comments${query({ sort, pageSize: 100 })}`, { headers: getAuthHeaders() })).data;
  },

  // use MangaDetailLayout.tsx: 404 means "not following"
  getFollowStatus: async (comicId: string) => {
    try {
      await request(`/me/following/${comicId}`, { headers: getAuthHeaders() });
      return { isFollowing: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return { isFollowing: false };
      throw error;
    }
  },

  rate: async (comicId: string, rating: number) => {
    const data = await request<{ comicId: string; averageRating: number; userRating: number }>(`/me/ratings/${comicId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rating }),
    });
    return { comicId: data.comicId, newAverageRating: data.averageRating, userRating: data.userRating };
  },

  // Taking a rating back; returns the new average.
  unrate: async (comicId: string) => {
    const data = await request<{ comicId: string; averageRating: number; userRating: number }>(`/me/ratings/${comicId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return { comicId: data.comicId, newAverageRating: data.averageRating, userRating: 0 };
  },

  // use MangaDetailLayout.tsx
  follow: async (comicId: string) => {
    await request(`/me/following/${comicId}`, { method: 'PUT', headers: getAuthHeaders() });
    return { isFollowing: true };
  },

  // use MangaDetailLayout.tsx
  unfollow: async (comicId: string) => {
    await request(`/me/following/${comicId}`, { method: 'DELETE', headers: getAuthHeaders() });
    return { isFollowing: false };
  },

  // Create a new comic (multipart form - requires FormData)
  create: (formData: FormData) =>
    multipartRequest<Comic>(`/comics`, formData, { method: 'POST', headers: getAuthHeaders() }),

  // Update an existing comic and reset it back to pending review
  update: (comicId: string, formData: FormData) =>
    multipartRequest<Comic>(`/comics/${comicId}`, formData, { method: 'PATCH', headers: getAuthHeaders() }),

  // Create a new chapter for a comic (multipart form - requires FormData)
  createChapter: (comicId: string, formData: FormData) =>
    multipartRequest<Chapter>(`/comics/${comicId}/chapters`, formData, { method: 'POST', headers: getAuthHeaders() }),
};

// Chapter-related API endpoints
export const chapterApi = {
  // Chapter pages (plus the reader's saved progress when logged in)
  getDetails: (chapterId: string) => request<Chapter>(`/chapters/${chapterId}`, { headers: getAuthHeaders() }),

  saveReadingHistory: (chapterId: string, currentPage: number) =>
    request<{ chapterId: string; currentPage: number }>(`/me/history/${chapterId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPage }),
    }),

  getComments: (chapterId: string, limit: number, offset: number, sortBy: CommentSort = 'best') =>
    listComments('chapters', chapterId, limit, offset, sortBy),

  createComment: (chapterId: string, content: string, parentCommentId?: string) => postComment('chapters', chapterId, content, parentCommentId),
  reactComment: commentById.react,
  deleteComment: commentById.remove,
  editComment: commentById.edit,
};

// Current user's profile and settings (/me)
export const userApi = {
  // EditProfilePanel.tsx
  getProfile: () => request<UserProfile>('/me', { headers: getAuthHeaders() }),

  // EditProfilePanel.tsx: only the fields sent change
  updateProfile: (profileData: Partial<UserProfile>) =>
    request<UserProfile>('/me', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(profileData) }),

  // EditProfilePanel.tsx (204: other sessions are logged out)
  updatePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<void>('/me/password', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),

  uploadAvatar: (avatarFile: File) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    return multipartRequest<UserProfile>('/me/avatar', formData, { method: 'PUT', headers: getAuthHeaders() });
  },

  uploadBackground: (backgroundFile: File) => {
    const formData = new FormData();
    formData.append('background', backgroundFile);
    return multipartRequest<UserProfile>('/me/background', formData, { method: 'PUT', headers: getAuthHeaders() });
  },

  // Only the fields sent change (see PreferenceSync).
  updatePreferences: (preferences: Preferences) =>
    request<Preferences>('/me/preferences', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(preferences) }),

  // FollowingTitlesPanel.tsx
  getFollowingList: () => request<FollowingComic[]>('/me/following', { headers: getAuthHeaders() }),

  getFollowingCategories: () => request<UserFollowingCategory[]>('/me/following-categories', { headers: getAuthHeaders() }),

  createFollowingCategory: (category: string) =>
    request<UserFollowingCategory>('/me/following-categories', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ category }),
    }),

  updateFollowingCategory: (categoryId: string, category: string) =>
    request<UserFollowingCategory>(`/me/following-categories/${categoryId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ category }),
    }),

  deleteFollowingCategory: (categoryId: string) =>
    request<void>(`/me/following-categories/${categoryId}`, { method: 'DELETE', headers: getAuthHeaders() }),

  // Moving a followed comic = PUT the follow again with the new category.
  updateFollowingComicCategory: async (comicId: string, categoryId: string | null) => {
    const data = await request<{ comicId: string; categoryId: string | null }>(`/me/following/${comicId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ categoryId }),
    });
    return { comicId: data.comicId, followingCategoryId: data.categoryId };
  },

  // The 100 most recent entries
  getReadingHistory: async () => (await requestPage<HistoryItem>('/me/history?pageSize=100', { headers: getAuthHeaders() })).data,

  deleteHistoryItem: (chapterId: string) => request<void>(`/me/history/${chapterId}`, { method: 'DELETE', headers: getAuthHeaders() }),

  clearReadingHistory: () => request<void>('/me/history', { method: 'DELETE', headers: getAuthHeaders() }),
};

// Public profiles (no login needed)
export const publicUserApi = {
  get: (userId: string) => request<PublicProfile>(`/users/${userId}`),

  getComments: async (userId: string, page = 1, pageSize = 20) => {
    const { data, meta } = await requestPage<UserComment>(`/users/${userId}/comments${query({ page, pageSize })}`);
    return { comments: data, meta };
  },
};

// Login, registration and password reset (no token needed)
export const authApi = {
  login: (userName: string, password: string) =>
    request<{ token: string; expiresAt: string; user: { id: string; userName: string; role?: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userName, password }),
    }),

  register: (userName: string, email: string, password: string, displayName: string) =>
    request<{ id: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ userName, email, password, displayName }) }),

  // Always succeeds, whether or not the email is registered.
  requestPasswordReset: (email: string) =>
    request<void>('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    request<void>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, newPassword, confirmPassword }) }),
};

// Notifications API
export const notificationApi = {
  // The 100 most recent notifications
  list: async () => (await requestPage<Notification>('/me/notifications?pageSize=100', { headers: getAuthHeaders() })).data,

  markRead: (id: string) =>
    request<Notification>(`/me/notifications/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isRead: true }),
    }),
};

// Comic Contributors API
export const comicContributorApi = {
  listMyContributions: () => request<ComicContributor[]>('/me/contributions/comics', { headers: getAuthHeaders() }),

  getByComic: (comicId: string) => request<ChapterContributor[]>(`/comics/${comicId}/contributors`, { headers: getAuthHeaders() }),

  updateStatus: (comicId: string, userId: string, status: 'accept' | 'reject') =>
    request<{ status: string }>(`/comics/${comicId}/contributors/${userId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),
};

// Chapter Contributors API
export const chapterContributorApi = {
  // Chapters I've contributed to, with their status
  listMyContributions: () => request<ChapterContributor[]>('/me/contributions/chapters', { headers: getAuthHeaders() }),

  getByChapter: (chapterId: string) => request<ChapterContributor[]>(`/chapters/${chapterId}/contributors`, { headers: getAuthHeaders() }),

  // Update contributor status (for moderators/admins)
  updateStatus: (chapterId: string, userId: string, status: 'accept' | 'reject') =>
    request<{ status: string }>(`/chapters/${chapterId}/contributors/${userId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),
};

export const moderationApi = {
  getQueue: (comicStatus?: 'pending' | 'accept' | 'reject', chapterStatus?: 'pending' | 'accept' | 'reject') =>
    request<{ comics: Comic[]; chapters: Chapter[] }>(`/moderation/queue${query({ comicStatus, chapterStatus })}`, {
      headers: getAuthHeaders(),
    }),

  review: (targetType: 'comic' | 'chapter', targetId: string, status: 'accept' | 'reject') =>
    request<{ id: string; status: string }>(`/moderation/${targetType === 'comic' ? 'comics' : 'chapters'}/${targetId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),

  getComicDetail: (comicId: string) => request<Comic>(`/moderation/comics/${comicId}`, { headers: getAuthHeaders() }),

  getReports: async (status?: ReportStatus) =>
    (await requestPage<Report>(`/moderation/reports${query({ status, pageSize: 100 })}`, { headers: getAuthHeaders() })).data,

  updateReport: (reportId: string, status: ReportStatus) =>
    request<{ id: string; status: ReportStatus }>(`/moderation/reports/${reportId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),

  // Soft-deletes anyone's comment (it shows as "deleted" in the thread).
  deleteComment: (commentId: string) =>
    request<void>(`/moderation/comments/${commentId}`, { method: 'DELETE', headers: getAuthHeaders() }),
};

// Any logged-in reader can flag a comic or a comment for the moderators.
export const reportApi = {
  create: (targetType: ReportTargetType, targetId: string, reason: string, details?: string) =>
    request<Report>('/reports', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetType, targetId, reason, details }),
    }),
};

export const adminApi = {
  getDashboard: () => request<DashboardResponse>('/admin/dashboard', { headers: getAuthHeaders() }),

  setAutoAccept: async (enabled: boolean) => {
    const data = await request<{ autoAccept: boolean }>('/admin/settings', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ autoAccept: enabled }),
    });
    return { enabled: data.autoAccept };
  },

  setUserRole: (userId: string, role: UserRole) =>
    request<{ id: string; role: UserRole }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    }),

  toggleUserBan: (userId: string, isBanned: boolean) =>
    request<{ id: string; isBanned: boolean }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isBanned }),
    }),

  // The comment id is enough; `targetType` is kept so callers don't change.
  toggleCommentBan: (_targetType: 'comic' | 'chapter', commentId: string, isBanned: boolean) =>
    request<{ id: string; isBanned: boolean }>(`/admin/comments/${commentId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isBanned }),
    }),

  getComics: async (visibility?: string) =>
    (await requestPage<Comic>(`/admin/comics${query({ visibility, pageSize: 100 })}`, { headers: getAuthHeaders() })).data,

  getChapters: async (visibility?: string) =>
    (await requestPage<Chapter>(`/admin/chapters${query({ visibility, pageSize: 100 })}`, { headers: getAuthHeaders() })).data,

  updateComicVisibility: (comicId: string, visibility: 'public' | 'hidden') =>
    request<{ id: string; visibility: string }>(`/admin/comics/${comicId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ visibility }),
    }),

  updateChapterVisibility: (chapterId: string, visibility: 'public' | 'hidden') =>
    request<{ id: string; visibility: string }>(`/admin/chapters/${chapterId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ visibility }),
    }),
};

export const commentApi = {
  // A comment with its replies; `type` says whether it belongs to a comic or a chapter.
  getDetail: async (commentId: string) => {
    const { type, ...comment } = await request<Comment & { type: 'comic' | 'chapter' }>(`/comments/${commentId}`, {
      headers: getAuthHeaders(),
    });
    return { comment: comment as Comment, type };
  },
};
