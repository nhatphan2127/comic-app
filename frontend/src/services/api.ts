// src/services/api.ts
import type { Comment, Comic, UserFollowingCategory, UserProfile, FollowingComic, HistoryItem, Notification, ComicContributor, ChapterContributor } from '../types/data';

export const API_BASE_URL = 'http://localhost:5000';
export const API_UPLOADS = 'http://localhost:5000/storage/';

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
  // Fetch paginated list of comics with optional filters
  list: (page?: number) =>
    request<{ comics: Comic[]; pagination: { page: number; totalPages: number } }>(
      `/comics${page ? `?page=${page}` : ''}`
    ),

  // Fetch top 10 most popular comics
  getPopular: () =>
    request<Comic[]>('/comics/popular'),

  // Fetch detailed comic information by URL (includes full chapters list)
  getByUrl: (url: string) =>
  request<Comic>(`/comics/${url}`, {
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

  follow: (comicId: string) =>
    request<{ isFollowing: boolean }>(`/comics/${comicId}/follow`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }),

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
    request<any>(`/comics/chapters/${chapterId}`, {
      headers: getAuthHeaders(),
    }),
  saveReadingHistory: (chapterId: string, currentPage: number, scrollPosition: number) =>
    request<any>(`/comics/chapters/${chapterId}/history`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPage, scrollPosition }),
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
};

// Get authorization header with JWT token from localStorage
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// User profile and settings API endpoints
export const userApi = {
  // Fetch current user's profile information
  getProfile: () => 
    request<UserProfile>('/api/user/profile', {
      headers: getAuthHeaders(),
    }),

  // Update current user's profile information (excludes password)
  updateProfile: (profileData: Omit<any, 'password' | 'confirmPassword'>) => 
    request<UserProfile>('/api/user/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    }),

  // Update user's password
  updatePassword: (newPassword: string, confirmPassword: string) =>
    request<{ message: string }>('/api/user/password-reset', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword, confirmPassword }),
    }),

  getFollowingList: () =>
    request<FollowingComic[]>('/api/user/following', {
      headers: getAuthHeaders(),
    }),

  getFollowingCategories: () =>
    request<UserFollowingCategory[]>('/api/user/following/categories', {
      headers: getAuthHeaders(),
    }),

  createFollowingCategory: (category: string) =>
    request<UserFollowingCategory>('/api/user/following/categories', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ category }),
    }),

  updateFollowingCategory: (categoryId: string, category: string) =>
    request<UserFollowingCategory>(`/api/user/following/categories/${categoryId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ category }),
    }),

  deleteFollowingCategory: (categoryId: string) =>
    request<{ message: string }>(`/api/user/following/categories/${categoryId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }),

  updateFollowingComicCategory: (comicId: string, categoryId: string | null) =>
    request<{ comicId: string; followingCategoryId: string | null }>(`/api/user/following/${comicId}/category`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ categoryId }),
    }),

  getReadingHistory: () =>
    request<HistoryItem[]>('/api/user/history', {
      headers: getAuthHeaders(),
    }),

  deleteHistoryItem: (chapterId: string) =>
    request<{ message: string }>(`/api/user/history/${chapterId}`, {
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
  // Get list of comics I've contributed to with status
  listMyContributions: () =>
    request<ComicContributor[]>('/api/user/comic-contributions', {
      headers: getAuthHeaders(),
    }),

  // Get contributors for a specific comic
  getByComic: (comicId: string) =>
    request<ChapterContributor[]>(`/comics/${comicId}/contributors`, {
      headers: getAuthHeaders(),
    }),

  // Update contributor status (for moderators/admins)
  updateStatus: (comicId: string, userId: string, status: 'accept' | 'reject') =>
    request<any>(`/comics/${comicId}/contributors/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }),

  // Mark contributor notification as read
  markRead: (comicId: string, userId: string) =>
    request<any>(`/comics/${comicId}/contributors/${userId}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
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

  // Mark contributor notification as read
  markRead: (chapterId: string, userId: string) =>
    request<any>(`/chapters/${chapterId}/contributors/${userId}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    }),
};