export interface User {
    // database thieu Contributor cho chapter
    id: string;
    avatar: string | null;
    displayName: string | null;
    username: string | null;
    email: string | null;
    bio: string | null;
    socialLinks: string | null;
    role?: string | null;
    // Optional aggregated stats returned by some APIs
    stats?: {
        titles?: number;
        groups?: number;
        chapters?: number;
        comments?: number;
        likes?: number;
    } | null;
    // Backwards-compatible individual count fields
    titlesCount?: number;
    groupsCount?: number;
    chaptersCount?: number;
    commentsCount?: number;
    likesCount?: number;
}

export interface UserProfile extends User {
    preference: {
        theme?: string;
        filter?: number | null;
    } | null;
}

// Chapter information interface - used in chapter lists
export interface ChapterImage {
    id: string;
    chapterId: string;
    urlPath: string;
    pageNumber: number;
}

export interface Chapter {
    id: string;
    comicId?: string;
    chapterNumber: number;
    title: string;
    url: string;
    createdAt?: string;
    updatedAt?: string;
    contributor?: string | null;
    images?: ChapterImage[];
    metadata: {
        currentPage: number,
        totalPages: number
    }
    // Admin properties
    status?: 'pending' | 'accept' | 'reject';
    visibility?: 'public' | 'hidden';
}

export interface ComicContributor {
    comicId: string;
    userId: string;
    status: 'pending' | 'accept' | 'reject'; // Trạng thái đóng góp
    unread: number; 
    createdAt: string;
    updatedAt: string;
    comic: {
        id: string;
        name: string;
        coverUrl: string;
        url: string;
        types: string;
        releasingStatus: string;
        contentRating: string;
        demographic:string;
    }
}

export interface ChapterContributor {
    chapterId: string;
    userId: string;
    status: 'pending' | 'accept' | 'reject'; // Trạng thái đóng góp
    unread: number; 
    createdAt: string;
    updatedAt: string;
    chapter: Chapter;
    comic: {
        name: string;
        coverUrl: string;
    };

}

export interface Notification {
    id: string;
    title: string;
    content: string;
    type: string;
    redirectPath: string;
    createdAt: string;
    isRead: number;

}

export interface ChapterDetail extends Chapter {
    images?: ChapterImage[];
}

export interface ComicDetail extends Comic {
    chapters?: Chapter[];
}

export interface Comic {
    // Basic information
    id: string;
    name?: string;
    source?: string;
    names: Array<{ name: string; country: string }>;
    url: string;
    coverUrl: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string | null;

    // Categories
    types?: string;
    contentRating?: string;
    demographic?: string;
    genres?: string[];
    tags?: string[];
    formats?: string[];
    releaseStatus?: string;

    // Time information
    releasingYear?: string;

    // Figures
    userRating?: number;
    rating?: number;
    view?: number;
    follow?: number;

    // Origins
    author?: string;
    artist?: string;

    // Admin properties
    status?: 'pending' | 'accept' | 'reject';
    visibility?: 'public' | 'hidden';

    latestChapters?: Chapter[] | [];
}

export interface Comment {
    id: string;
    comicId: string | null;
    userId: string;
    content: string;
    chapterId: string | null;
    childCommment: Comment[] | null;
    like: number;
    dislike: number;
    userReaction?: 'like' | 'dislike' | 'none';
    updatedAt: string;
    createdAt: string;
    displayName?: string;
    avatar?: string;
    user?: {
        id: string;
        displayName: string;
        avatar: string;
    };
    // Admin dashboard properties
    source?: 'comic' | 'chapter';
    targetId?: string;
    isBanned?: number;
}

export interface AdminUser {
    id: string;
    username: string;
    displayName?: string;
    role?: string;
    isBanned: number;
    createdAt?: string;
}

export interface FollowingComic {
    userId: string;
    updatedAt: string;
    comic: Comic;
    category: UserFollowingCategory | null;
    readedChapter: number
    totalChapters: number
}

export interface UserFollowingCategory {
    id: string;
    category: string;
}

export interface DashboardResponse {
    users: AdminUser[];
    comments: Comment[];
    autoAccept: boolean;
}

export interface HistoryItem {
    chapterId: string;
    comicName: string;
    comicUrl: string;
    coverUrl?: string | null;
    chapterTitle?: string | null;
    chapterNumber?: number;
    currentPage: number;
    scrollPosition?: number;
    totalPage: number;
    readAt: string;
}

// data.ts
export const PROFILE_TEXTS = {
    title: "Edit Profile",
    subtitle: "Update how you appear on the site. Email and password changes require confirmation.",
    avatar: {
        label: "Avatar",
        note: "JPG, PNG or WebP, up to 1 MB."
    },
    identity: {
        label: "Identity",
        subtext: "Shown on your profile and next to your comments.",
        displayName: "DISPLAY NAME",
        username: "USERNAME",
        usernameHint: "Lowercase letters, numbers, dot, underscore, hyphen."
    },
    bio: {
        label: "Bio",
        subtext: "A short blurb shown on your public profile.",
        placeholder: "Tell readers a little about yourself..."
    },
    social: {
        label: "Social links",
        subtext: "Optional. One link per line — only lines starting with http(s):// are kept, max 5.",
        placeholder: "https://twitter.com/yourhandle\nhttps://bsky.app/profile/you.bsky.social\nhttps://your-site.com"
    },
    email: {
        label: "Email",
        subtext: "Used for sign-in and notifications.",
        placeholder: "your-email@gmail.com"
    },
    password: {
        label: "Password",
        subtext: "Leave blank to keep your current password. Minimum 6 characters.",
        newPassword: "NEW PASSWORD",
        confirmPassword: "CONFIRM NEW PASSWORD"
    },
    buttonSave: "Save changes"
};

export const PROFILE_MESSAGES = {
    success: "Cập nhật tài khoản thành công!",
    passwordMismatch: "Mật khẩu xác nhận không trùng khớp.",
    passwordTooShort: "Mật khẩu phải chứa ít nhất 6 ký tự.",
    imageSizeError: "Kích thước ảnh vượt quá 1MB. Vui lòng chọn ảnh nhẹ hơn.",
    fetchError: "Không thể lấy thông tin tài khoản.",
    updateError: "Cập nhật thất bại. Vui lòng thử lại."
};
