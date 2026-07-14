// src/services/api.ts
import type { Comment, Comic, UserFollowingCategory, UserProfile, FollowingComic, HistoryItem, Notification, ComicContributor, ChapterContributor, Chapter } from '../types/types';

export const API_BASE_URL = 'http://localhost:5000';
export const API_UPLOADS = 'http://localhost:5000/storage/';
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

// Generic request handler with standardized response parsing
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json();

  // Extract data from standardized API response wrapper
  if (payload && typeof payload === 'object' && 'status' in payload) {
    if (payload.status === 'success' && 'data' in payload) {
      return payload.data as T;
    }

    // Handle error messages
    if ('message' in payload) {
      throw new Error(typeof payload.message === 'string' ? payload.message : 'Request failed');
    }
  }

  return payload as T;
}

async function multipartRequest<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  const payload = await response.json();
  if (payload && typeof payload === 'object' && 'status' in payload) {
    if (payload.status === 'success' && 'data' in payload) {
      return payload.data as T;
    }
    if ('message' in payload) {
      throw new Error(typeof payload.message === 'string' ? payload.message : 'Request failed');
    }
  }

  return payload as T;
}

// Comic-related API endpoints
export const comicApi = {
  // use Main.tsx
  list: (page?: number, contentFilter?: ContentFilter | string) => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));

    getContentRatingValues(contentFilter ?? getStoredContentFilter()).forEach((rating) => {
      params.append('contentRating', rating);
    });

    const queryString = params.toString();
    return request<{ comics: Comic[]; metadata: { page: number; totalPages: number } }>(
      `/comics${queryString ? `?${queryString}` : ''}`
    );
  },

  // use Main.tsx
  getPopular: (contentFilter?: ContentFilter | string) => {
    const params = new URLSearchParams();
    getContentRatingValues(contentFilter ?? getStoredContentFilter()).forEach((rating) => {
      params.append('contentRating', rating);
    });

    const queryString = params.toString();
    return request<Comic[]>(`/comics/popular${queryString ? `?${queryString}` : ''}`);
  },

  search: (query: string) =>
    request<ComicSearchResult[]>(`/comics/search?q=${encodeURIComponent(query)}`),

  // use MangaDetailLayout.tsx
  getByUrl: (url: string) =>
    request<Comic>(`/comics/${url}`, {
      headers: getAuthHeaders(),
    }),

  // use MangaDetailLayout.tsx
  getChaptersByUrl: (url: string) =>
    request<Chapter[]>(`/comics/${url}/chapters`, {
      headers: getAuthHeaders(),
    }),

  // Fetch all comments for a specific comic
  getComments: (comicId: string, limit: number, offset: number, sortBy: 'best' | 'newest' | 'oldest' = 'best') =>
    request<{ comments: Comment[]; total: number; sortBy: string }>(`/comments/comics/${comicId}?limit=${limit}&offset=${offset}&sortBy=${sortBy}`),

  // Post a new comment on a comic
  createComment: (comicId: string, content: string, parentCommentId?: string) =>
    request<any>(`/comments/comics/${comicId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, parentCommentId }),
    }),

  reactComment: (commentId: string, reactionType: 'like' | 'dislike' | 'none') =>
    reactionType === 'none'
      ? request<any>(`/comments/comics/${commentId}/react`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      : request<any>(`/comments/comics/${commentId}/react`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reactionType }),
      }),

  deleteComment: (commentId: string) =>
    request<any>(`/comments/comics/${commentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }),

  getUserComments: (sortBy: 'recent' | 'most-liked' | 'most-replies' = 'recent') =>
    request<any[]>(`/comments/user?sortBy=${sortBy}`, {
      headers: getAuthHeaders(),
    }),

  // use MangaDetailLayout.tsx
  getFollowStatus: (comicId: string) =>
    request<{ isFollowing: boolean }>(`/comics/${comicId}/follow`, {
      headers: getAuthHeaders(),
    }),

  rate: (comicId: string, rating: number) =>
    request<{ comicId: string; newAverageRating: number; userRating: number }>(`/comics/${comicId}/rate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rating }),
    }),

  // use MangaDetailLayout.tsx
  follow: (comicId: string) =>
    request<{ isFollowing: boolean }>(`/comics/${comicId}/follow`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }),

  // use MangaDetailLayout.tsx
  unfollow: (comicId: string) =>
    request<{ isFollowing: boolean }>(`/comics/${comicId}/follow`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }),

  // Create a new comic (multipart form - requires FormData)
  create: (formData: FormData) =>
    multipartRequest<any>(`/comics`, formData, {
      method: 'POST',
      headers: getAuthHeaders(),
    }),

  // Update an existing comic and reset it back to pending review
  update: (comicId: string, formData: FormData) =>
    multipartRequest<any>(`/comics/${comicId}`, formData, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    }),

  // Create a new chapter for a comic (multipart form - requires FormData)
  createChapter: (comicId: string, formData: FormData) =>
    multipartRequest<any>(`/comics/${comicId}/chapters`, formData, {
      method: 'POST',
      headers: getAuthHeaders(),
    }),
};

// Chapter-related API endpoints
export const chapterApi = {
  // Fetch detailed chapter information (includes images and reading history if authenticated)
  getDetails: (chapterId: string) =>
    request<Chapter>(`/comics/chapters/${chapterId}`, {
      headers: getAuthHeaders(),
    }),
  saveReadingHistory: (chapterId: string, currentPage: number) =>
    request<any>(`/comics/chapters/${chapterId}/history`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPage }),
    }),

  // Fetch all comments for a specific chapter
  getComments: (chapterId: string, limit: number, offset: number) =>
    request<{ comments: Comment[] }>(`/comments/chapters/${chapterId}?limit=${limit}&offset=${offset}`),

  // Post a new comment on a chapter
  createComment: (chapterId: string, content: string, parentCommentId?: string) =>
    request<any>(`/comments/chapters/${chapterId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, parentCommentId }),
    }),

  reactComment: (commentId: string, reactionType: 'like' | 'dislike' | 'none') =>
    reactionType === 'none'
      ? request<any>(`/comments/chapters/${commentId}/react`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      : request<any>(`/comments/chapters/${commentId}/react`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reactionType }),
      }),

  deleteComment: (commentId: string) =>
    request<any>(`/comments/chapters/${commentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }),
};

// Get authorization header with JWT token from localStorage
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// User profile and settings API endpoints
export const userApi = {
  // Fetch current user's profile information
  // EditProfilePanel.tsx
  getProfile: () =>
    request<UserProfile>('/user/profile', {
      headers: getAuthHeaders(),
    }),

  // Update current user's profile information (excludes password)
  // EditProfilePanel.tsx
  updateProfile: (profileData: Omit<any, 'password' | 'confirmPassword'>) =>
    request<UserProfile>('/user/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    }),

  // Update user's password
  // EditProfilePanel.tsx
  updatePassword: (newPassword: string, confirmPassword: string) =>
    request<{ message: string }>('/user/password-reset', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword, confirmPassword }),
    }),
  
  // FollowingTitlesPanel.tsx
  getFollowingList: () =>
    request<FollowingComic[]>('/user/following', {
      headers: getAuthHeaders(),
    }),

  // FollowingTitlesPanel.tsx
  getFollowingCategories: () =>
    request<UserFollowingCategory[]>('/user/following/categories', {
      headers: getAuthHeaders(),
    }),
  
  // FollowingTitlesPanel.tsx
  createFollowingCategory: (category: string) =>
    request<UserFollowingCategory>('/user/following/categories', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ category }),
    }),
  
  // FollowingTitlesPanel.tsx
  updateFollowingCategory: (categoryId: string, category: string) =>
    request<UserFollowingCategory>(`/user/following/categories/${categoryId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ category }),
    }),

  // FollowingTitlesPanel.tsx
  deleteFollowingCategory: (categoryId: string) =>
    request<{ message: string }>(`/user/following/categories/${categoryId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }),

  // FollowingTitlesPanel.tsx
  updateFollowingComicCategory: (comicId: string, categoryId: string | null) =>
    request<{ comicId: string; followingCategoryId: string | null }>(`/user/following/${comicId}/category`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ categoryId }),
    }),

  getReadingHistory: () =>
    request<HistoryItem[]>('/user/history', {
      headers: getAuthHeaders(),
    }),

  deleteHistoryItem: (chapterId: string) =>
    request<{ message: string }>(`/user/history/${chapterId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }),
};

// Notifications API
export const notificationApi = {
  // List notifications for current user
  list: () =>
    request<Notification[]>('/api/notifications', {
      headers: getAuthHeaders(),
    }),

  // Mark a single notification as read
  markRead: (id: string) =>
    request<any>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    }),
};

// Comic Contributors API
export const comicContributorApi = {
  listMyContributions: () =>
    request<ComicContributor[]>('/api/user/comic-contributions', {
      headers: getAuthHeaders(),
    }),

  getByComic: (comicId: string) =>
    request<ChapterContributor[]>(`/comics/${comicId}/contributors`, {
      headers: getAuthHeaders(),
    }),

  updateStatus: (comicId: string, userId: string, status: 'accept' | 'reject') =>
    request<any>(`/comics/${comicId}/contributors/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),
};

// Chapter Contributors API
export const chapterContributorApi = {
  // Get list of chapters I've contributed to with status
  listMyContributions: () =>
    request<any>('/api/user/chapter-contributions', {
      headers: getAuthHeaders(),
    }),

  // Get contributors for a specific chapter
  getByChapter: (chapterId: string) =>
    request<any>(`/chapters/${chapterId}/contributors`, {
      headers: getAuthHeaders(),
    }),

  // Update contributor status (for moderators/admins)
  updateStatus: (chapterId: string, userId: string, status: 'accept' | 'reject') =>
    request<any>(`/chapters/${chapterId}/contributors/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),
};

export const moderationApi = {
  getQueue: (comicStatus?: 'pending' | 'accept' | 'reject', chapterStatus?: 'pending' | 'accept' | 'reject') => {
    const params = new URLSearchParams();
    if (comicStatus) params.append('comicStatus', comicStatus);
    if (chapterStatus) params.append('chapterStatus', chapterStatus);
    const queryString = params.toString();
    const path = `/api/admin/moderation/queue${queryString ? '?' + queryString : ''}`;
    return request<{ comics: any[]; chapters: any[] }>(path, {
      headers: getAuthHeaders(),
    });
  },
  review: (targetType: 'comic' | 'chapter', targetId: string, status: 'accept' | 'reject') =>
    request<any>(`/api/admin/moderation/${targetType}/${targetId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),
};

export const adminApi = {
  getDashboard: () =>
    request<any>('/api/admin/dashboard', {
      headers: getAuthHeaders(),
    }),
  setAutoAccept: (enabled: boolean) =>
    request<any>('/api/admin/settings/auto-accept', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled }),
    }),
  toggleUserBan: (userId: string, isBanned: boolean) =>
    request<any>(`/api/admin/users/${userId}/ban`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isBanned }),
    }),
  toggleCommentBan: (targetType: 'comic' | 'chapter', commentId: string, isBanned: boolean) =>
    request<any>(`/api/admin/comments/${targetType}/${commentId}/ban`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isBanned }),
    }),
  getComics: (visibility?: string) =>
    request<any>(`/api/admin/comics-dashboard${visibility ? `?visibility=${visibility}` : ''}`, {
      headers: getAuthHeaders(),
    }),
  getChapters: (visibility?: string) =>
    request<any>(`/api/admin/chapters-dashboard${visibility ? `?visibility=${visibility}` : ''}`, {
      headers: getAuthHeaders(),
    }),
  updateComicVisibility: (comicId: string, visibility: 'public' | 'hidden') =>
    request<any>(`/api/admin/comics/${comicId}/visibility`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ visibility }),
    }),
  updateChapterVisibility: (chapterId: string, visibility: 'public' | 'hidden') =>
    request<any>(`/api/admin/chapters/${chapterId}/visibility`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ visibility }),
    }),
};