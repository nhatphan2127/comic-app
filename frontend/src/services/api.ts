// src/services/api.ts
import type { Comment, Comic, UserFollowingCategory, UserProfile, FollowingComic, HistoryItem, Notification, ComicContributor, ChapterContributor, Chapter, DashboardResponse, AdminUser, ApiKey, ApiKeyScope, RoleRequest, RoleRequestState, RoleRequestListItem, RoleRequestStatus, Report, ReportStatus, ReportTargetType, UserRole, Preferences, PublicProfile, UserComment, RankingPeriod } from '../types/types';

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

export interface UploadableComic {
  id: string;
  name: string;
  url: string;
  coverUrl: string | null;
  types: string;
  status: 'pending' | 'accept' | 'reject';
  visibility: 'public' | 'hidden';
  /** Highest chapter number already taken, pending chapters included. */
  latestChapter: number | null;
  mine: boolean;
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

// The auth middleware's 401 messages. Other 401s (a wrong current password) keep the session.
const SESSION_ENDED = ['Invalid or expired session token', 'Authentication required'];

async function send<T>(path: string, init?: RequestInit): Promise<{ data: T; meta?: PageMeta }> {
  // The session lives in an HttpOnly cookie for the API origin; 'include' sends it cross-origin.
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include' });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    // The session is gone (expired, logged out elsewhere, password reset, cookie missing): drop the local copy.
    if (response.status === 401 && SESSION_ENDED.includes(problem?.detail)) {
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

// The UI loads comments with limit/offset ("load more"); the API pages with page/pageSize.
const COMMENT_SORT = { best: '-score', newest: '-createdAt', oldest: 'createdAt' } as const;
type CommentSort = keyof typeof COMMENT_SORT;

async function listComments(kind: 'comics' | 'chapters', targetId: string, limit: number, offset: number, sortBy: CommentSort) {
  const page = Math.floor(offset / limit) + 1;
  const { data, meta } = await requestPage<Comment>(
    `/${kind}/${targetId}/comments${query({ page, pageSize: limit, sort: COMMENT_SORT[sortBy] })}`,
  );
  return { comments: data, total: meta.totalItems, sortBy };
}

// Single comments are addressed by id only, whatever they belong to.
const commentById = {
  react: (commentId: string, reactionType: 'like' | 'dislike' | 'none') =>
    reactionType === 'none'
      ? request<void>(`/comments/${commentId}/reaction`, { method: 'DELETE' })
      : request<{ likes: number; dislikes: number; userReaction: string }>(`/comments/${commentId}/reaction`, {
        method: 'PUT',
        body: JSON.stringify({ type: reactionType }),
      }),
  remove: (commentId: string) => request<void>(`/comments/${commentId}`, { method: 'DELETE' }),
  edit: (commentId: string, content: string) =>
    request<{ id: string; content: string }>(`/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
};

const postComment = (kind: 'comics' | 'chapters', targetId: string, content: string, parentCommentId?: string) =>
  request<Comment>(`/${kind}/${targetId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parentCommentId }),
  });

// Comic-related API endpoints
export const comicApi = {
  // use Main.tsx
  list: async (page?: number, contentFilter?: ContentFilter | string) => {
    const { data, meta } = await requestPage<Comic>(`/comics${query({ page, contentRating: contentRatingParam(contentFilter) })}`);
    return { comics: data, metadata: { page: meta.page, totalPages: meta.totalPages } };
  },

  // use MainLayout.tsx: most active comics of the period (views + new follows + new ratings)
  getRankings: async (period: RankingPeriod, limit = 10, contentFilter?: ContentFilter | string) =>
    (await requestPage<Comic>(`/comics/rankings${query({ period, pageSize: limit, contentRating: contentRatingParam(contentFilter) })}`)).data,

  // use HeroCarousel in MainLayout.tsx: most viewed of all time
  getPopular: async (limit = 8, contentFilter?: ContentFilter | string) =>
    (await requestPage<Comic>(`/comics${query({ sort: '-view', pageSize: limit, contentRating: contentRatingParam(contentFilter) })}`)).data,

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

  // use MangaDetailLayout.tsx (accepts the url slug or the id). Approved, public comics only.
  getByUrl: (url: string) => request<Comic>(`/comics/${url}`),

  // use the studio editor: a comic I may edit, in any review state, with its edit awaiting review if any
  getForEditing: (urlOrId: string) => request<Comic>(`/me/editable-comics/${urlOrId}`),

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
    return (await requestPage<UserComment>(`/me/comments${query({ sort, pageSize: 100 })}`)).data;
  },

  // use MangaDetailLayout.tsx: 404 means "not following"
  getFollowStatus: async (comicId: string) => {
    try {
      await request(`/me/following/${comicId}`);
      return { isFollowing: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return { isFollowing: false };
      throw error;
    }
  },

  rate: async (comicId: string, rating: number) => {
    const data = await request<{ comicId: string; averageRating: number; userRating: number }>(`/me/ratings/${comicId}`, {
      method: 'PUT',
      body: JSON.stringify({ rating }),
    });
    return { comicId: data.comicId, newAverageRating: data.averageRating, userRating: data.userRating };
  },

  // Taking a rating back; returns the new average.
  unrate: async (comicId: string) => {
    const data = await request<{ comicId: string; averageRating: number; userRating: number }>(`/me/ratings/${comicId}`, {
      method: 'DELETE',
    });
    return { comicId: data.comicId, newAverageRating: data.averageRating, userRating: 0 };
  },

  // use MangaDetailLayout.tsx
  follow: async (comicId: string) => {
    await request(`/me/following/${comicId}`, { method: 'PUT' });
    return { isFollowing: true };
  },

  // use MangaDetailLayout.tsx
  unfollow: async (comicId: string) => {
    await request(`/me/following/${comicId}`, { method: 'DELETE' });
    return { isFollowing: false };
  },

  // Create a new comic (multipart form - requires FormData)
  create: (formData: FormData) =>
    multipartRequest<Comic>(`/comics`, formData, { method: 'POST' }),

  // Update an existing comic and reset it back to pending review
  update: (comicId: string, formData: FormData) =>
    multipartRequest<Comic>(`/comics/${comicId}`, formData, { method: 'PATCH' }),

  // Create a new chapter for a comic (multipart form - requires FormData)
  createChapter: (comicId: string, formData: FormData) =>
    multipartRequest<Chapter>(`/comics/${comicId}/chapters`, formData, { method: 'POST' }),
};

// Chapter-related API endpoints
export const chapterApi = {
  // Chapter pages (plus the reader's saved progress when logged in)
  getDetails: (chapterId: string) => request<Chapter>(`/chapters/${chapterId}`),

  saveReadingHistory: (chapterId: string, currentPage: number) =>
    request<{ chapterId: string; currentPage: number }>(`/me/history/${chapterId}`, {
      method: 'PUT',
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
  getProfile: () => request<UserProfile>('/me'),

  // EditProfilePanel.tsx: only the fields sent change
  updateProfile: (profileData: Partial<UserProfile>) =>
    request<UserProfile>('/me', { method: 'PATCH', body: JSON.stringify(profileData) }),

  // EditProfilePanel.tsx (204: other sessions are logged out)
  updatePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<void>('/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),

  uploadAvatar: (avatarFile: File) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    return multipartRequest<UserProfile>('/me/avatar', formData, { method: 'PUT' });
  },

  uploadBackground: (backgroundFile: File) => {
    const formData = new FormData();
    formData.append('background', backgroundFile);
    return multipartRequest<UserProfile>('/me/background', formData, { method: 'PUT' });
  },

  // Only the fields sent change (see PreferenceSync).
  updatePreferences: (preferences: Preferences) =>
    request<Preferences>('/me/preferences', { method: 'PATCH', body: JSON.stringify(preferences) }),

  // FollowingTitlesPanel.tsx
  getFollowingList: () => request<FollowingComic[]>('/me/following'),

  getFollowingCategories: () => request<UserFollowingCategory[]>('/me/following-categories'),

  createFollowingCategory: (category: string) =>
    request<UserFollowingCategory>('/me/following-categories', {
      method: 'POST',
      body: JSON.stringify({ category }),
    }),

  updateFollowingCategory: (categoryId: string, category: string) =>
    request<UserFollowingCategory>(`/me/following-categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    }),

  deleteFollowingCategory: (categoryId: string) =>
    request<void>(`/me/following-categories/${categoryId}`, { method: 'DELETE' }),

  // Moving a followed comic = PUT the follow again with the new category.
  updateFollowingComicCategory: async (comicId: string, categoryId: string | null) => {
    const data = await request<{ comicId: string; categoryId: string | null }>(`/me/following/${comicId}`, {
      method: 'PUT',
      body: JSON.stringify({ categoryId }),
    });
    return { comicId: data.comicId, followingCategoryId: data.categoryId };
  },

  // The 100 most recent entries
  getReadingHistory: async () => (await requestPage<HistoryItem>('/me/history?pageSize=100')).data,

  deleteHistoryItem: (chapterId: string) => request<void>(`/me/history/${chapterId}`, { method: 'DELETE' }),

  clearReadingHistory: () => request<void>('/me/history', { method: 'DELETE' }),
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
  // The session token comes back only as an HttpOnly cookie, never in the body.
  login: (userName: string, password: string) =>
    request<{ expiresAt: string; user: { id: string; userName: string; role?: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userName, password }),
    }),

  // Ends the session on the server and clears the cookie (scripts cannot clear an HttpOnly cookie).
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

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
  list: async () => (await requestPage<Notification>('/me/notifications?pageSize=100')).data,

  markRead: (id: string) =>
    request<Notification>(`/me/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    }),
};

// Comic Contributors API
export const comicContributorApi = {
  listMyContributions: () => request<ComicContributor[]>('/me/contributions/comics'),

  getByComic: (comicId: string) => request<ChapterContributor[]>(`/comics/${comicId}/contributors`),

  updateStatus: (comicId: string, userId: string, status: 'accept' | 'reject') =>
    request<{ status: string }>(`/comics/${comicId}/contributors/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// Chapter Contributors API
export const chapterContributorApi = {
  // Chapters I've contributed to, with their status
  listMyContributions: () => request<ChapterContributor[]>('/me/contributions/chapters'),

  getByChapter: (chapterId: string) => request<ChapterContributor[]>(`/chapters/${chapterId}/contributors`),

  // Update contributor status (for moderators/admins)
  updateStatus: (chapterId: string, userId: string, status: 'accept' | 'reject') =>
    request<{ status: string }>(`/chapters/${chapterId}/contributors/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const moderationApi = {
  getQueue: (comicStatus?: 'pending' | 'accept' | 'reject', chapterStatus?: 'pending' | 'accept' | 'reject') =>
    request<{ comics: Comic[]; chapters: Chapter[] }>(`/moderation/queue${query({ comicStatus, chapterStatus })}`, {
    }),

  review: (targetType: 'comic' | 'chapter', targetId: string, status: 'accept' | 'reject') =>
    request<{ id: string; status: string }>(`/moderation/${targetType === 'comic' ? 'comics' : 'chapters'}/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getComicDetail: (comicId: string) => request<Comic>(`/moderation/comics/${comicId}`),

  // Any chapter with its pages (pending or hidden too); unlike /chapters/:id it is not recorded as reading.
  getChapterDetail: (chapterId: string) => request<Chapter>(`/moderation/chapters/${chapterId}`),

  listReports: (params: { status?: ReportStatus; page?: number; pageSize?: number }) =>
    requestPage<Report>(`/moderation/reports${query({ ...params })}`),

  /** Number of reports in a state (one tiny page, read from `meta`). */
  countReports: async (status: ReportStatus) =>
    (await requestPage<Report>(`/moderation/reports${query({ status, pageSize: 1 })}`)).meta.totalItems,

  /** Comics + chapters waiting for review. */
  countPending: async () => {
    const queue = await request<{ comics: Comic[]; chapters: Chapter[] }>('/moderation/queue?comicStatus=pending&chapterStatus=pending', {
    });
    return (queue.comics?.length ?? 0) + (queue.chapters?.length ?? 0);
  },

  updateReport: (reportId: string, status: ReportStatus) =>
    request<{ id: string; status: ReportStatus }>(`/moderation/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Soft-deletes anyone's comment (it shows as "deleted" in the thread).
  deleteComment: (commentId: string) =>
    request<void>(`/moderation/comments/${commentId}`, { method: 'DELETE' }),
};

// Any logged-in reader can flag a comic or a comment for the moderators.
export const reportApi = {
  create: (targetType: ReportTargetType, targetId: string, reason: string, details?: string) =>
    request<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, reason, details }),
    }),
};

// A reader asking to become a contributor (profile → "Become a contributor").
export const roleRequestApi = {
  get: () => request<RoleRequestState>('/me/role-request'),

  create: (reason: string, portfolio?: string) =>
    request<RoleRequest>('/me/role-request', {
      method: 'POST',
      body: JSON.stringify({ reason, portfolio }),
    }),

  cancel: () => request<void>('/me/role-request', { method: 'DELETE' }),
};

// Keys for the publishing API (Studio → API keys).
export const apiKeyApi = {
  list: () => request<ApiKey[]>('/me/api-keys'),

  /** The response's `token` is the full key; the server never shows it again. */
  create: (body: { name: string; password: string; scopes: ApiKeyScope[]; expiresInDays: number }) =>
    request<ApiKey>('/me/api-keys', { method: 'POST', body: JSON.stringify(body) }),

  revoke: (keyId: string) => request<void>(`/me/api-keys/${keyId}`, { method: 'DELETE' }),

  /** Comics the user's keys can add chapters to: approved ones plus the unreviewed ones they contribute to. */
  listUploadableComics: (params: { q?: string; page?: number; pageSize?: number }) =>
    requestPage<UploadableComic>(`/me/uploadable-comics${query(params)}`),
};

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export const adminApi = {
  getDashboard: () => request<DashboardResponse>('/admin/dashboard'),

  getSettings: () => request<{ autoAccept: boolean }>('/admin/settings'),

  listUsers: (params: PageParams & { q?: string; role?: UserRole | ''; isBanned?: boolean }) =>
    requestPage<AdminUser>(`/admin/users${query({ ...params, isBanned: params.isBanned === undefined ? undefined : String(params.isBanned) })}`, {
    }),

  listContent: <T extends Comic | Chapter>(
    kind: 'comic' | 'chapter',
    params: PageParams & { q?: string; visibility?: 'public' | 'hidden' | ''; status?: string },
  ) => requestPage<T>(`/admin/${kind === 'comic' ? 'comics' : 'chapters'}${query({ ...params })}`),

  listRoleRequests: (params: PageParams & { status?: RoleRequestStatus }) =>
    requestPage<RoleRequestListItem>(`/admin/role-requests${query({ ...params })}`),

  decideRoleRequest: (requestId: string, status: 'approved' | 'rejected', note?: string) =>
    request<RoleRequest>(`/admin/role-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),

  setAutoAccept: async (enabled: boolean) => {
    const data = await request<{ autoAccept: boolean }>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ autoAccept: enabled }),
    });
    return { enabled: data.autoAccept };
  },

  setUserRole: (userId: string, role: UserRole) =>
    request<{ id: string; role: UserRole }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  toggleUserBan: (userId: string, isBanned: boolean) =>
    request<{ id: string; isBanned: boolean }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned }),
    }),

  // The comment id is enough; `targetType` is kept so callers don't change.
  toggleCommentBan: (_targetType: 'comic' | 'chapter', commentId: string, isBanned: boolean) =>
    request<{ id: string; isBanned: boolean }>(`/admin/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned }),
    }),

  getComics: async (visibility?: string) =>
    (await requestPage<Comic>(`/admin/comics${query({ visibility, pageSize: 100 })}`)).data,

  getChapters: async (visibility?: string) =>
    (await requestPage<Chapter>(`/admin/chapters${query({ visibility, pageSize: 100 })}`)).data,

  updateComicVisibility: (comicId: string, visibility: 'public' | 'hidden') =>
    request<{ id: string; visibility: string }>(`/admin/comics/${comicId}`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    }),

  updateChapterVisibility: (chapterId: string, visibility: 'public' | 'hidden') =>
    request<{ id: string; visibility: string }>(`/admin/chapters/${chapterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    }),
};

export const commentApi = {
  // A comment with its replies; `type` says whether it belongs to a comic or a chapter.
  getDetail: async (commentId: string) => {
    const { type, ...comment } = await request<Comment & { type: 'comic' | 'chapter' }>(`/comments/${commentId}`, {
    });
    return { comment: comment as Comment, type };
  },
};
