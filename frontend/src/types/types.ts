export interface User {
    // database thieu Contributor cho chapter
    id: string;
    avatar: string | null;
    background: string | null;
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
        following?: number;
        collections?: number;
    } | null;
    // Backwards-compatible individual count fields
    titlesCount?: number;
    groupsCount?: number;
    chaptersCount?: number;
    commentsCount?: number;
    likesCount?: number;
}

export interface UserProfile extends User {
    preference: Preferences | null;
}

export interface Preferences {
    theme?: 'main' | 'dark' | 'light';
    /** 0 safe, 1 suggestive, 2 erotica, 3 pornographic: the highest rating shown. */
    filter?: number | null;
    /** Reader settings as saved by the reader; null = never saved. */
    reader?: Record<string, unknown> | null;
}

/** Someone else's profile: no email, no settings. */
export interface PublicProfile {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    background: string | null;
    bio: string | null;
    socialLinks: string | null;
    role?: UserRole;
    createdAt?: string;
    stats: { following: number; comments: number; likes: number };
}

/** A comment as listed on a profile (with the comic it belongs to). */
export interface UserComment {
    id: string;
    content: string;
    createdAt: string;
    likes?: number;
    dislikes?: number;
    targetName?: string;
    targetUrl?: string;
    targetCoverUrl?: string | null;
    chapterId?: string | null;
    type?: 'comic' | 'chapter';
    replyCount?: number;
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
    /** Staff listings include the comic the chapter belongs to. */
    comicName?: string | null;
    comicUrl?: string | null;
}

export interface ComicContributor {
    comicId: string;
    userId: string;
    status: 'pending' | 'accept' | 'reject'; // Trạng thái đóng góp
    /** The comic is live and an edit of it is waiting for review. */
    pendingEdit?: boolean;
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
        url?: string;
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

/** GET /comics/rankings: today, the last 7 days, the last 30 days, or all time. */
export type RankingPeriod = 'day' | 'week' | 'month' | 'all';

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
    ratingCount?: number;
    view?: number;
    follow?: number;

    // Origins
    author?: string;
    artist?: string;

    // Admin properties
    status?: 'pending' | 'accept' | 'reject';
    visibility?: 'public' | 'hidden';
    /** Studio / moderation only: the comic is live and an edit of it is waiting for review. */
    pendingEdit?: boolean | number;

    latestChapters?: Chapter[] | [];

    /** Rankings only: position (1-based) and activity score within the requested period. */
    rank?: number;
    score?: number;

    /** Where the logged-in viewer left off (public detail only); null = never opened. */
    progress?: {
        lastChapterId: string;
        lastPage: number;
        readChapterIds: string[];
    } | null;
}

export interface Comment {
    id: string;
    comicId: string | null;
    userId: string;
    content: string;
    chapterId: string | null;
    childComment: Comment[] | null;
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

export type UserRole = 'user' | 'contributor' | 'moderator' | 'admin';

export interface AdminUser {
    id: string;
    username: string;
    displayName?: string;
    email?: string | null;
    avatar?: string | null;
    role?: UserRole;
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
    /** Readable chapters after the furthest one read. */
    unreadChapters: number
    latestChapterAt: string | null
    lastReadAt: string | null
    followedAt: string | null
}

export interface UserFollowingCategory {
    id: string;
    category: string;
}

export interface DashboardTotals {
    users: number;
    staff: number;
    comics: number;
    chapters: number;
    pendingReviews: number;
    openReports: number;
    pendingRoleRequests: number;
}

export interface DashboardResponse {
    totals: DashboardTotals;
    users: AdminUser[];
    comments: Comment[];
    comics: Comic[];
    chapters: Chapter[];
    autoAccept: boolean;
}

export type ApiKeyScope = 'comics:write' | 'chapters:write' | 'bulk:write';

/** A publishing API key as its owner sees it (never the secret, except `token` right after creation). */
export interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    hint: string;
    scopes: ApiKeyScope[];
    status: 'active' | 'expired' | 'revoked';
    expiresAt: string;
    lastUsedAt: string | null;
    lastUsedIp: string | null;
    revokedAt: string | null;
    createdAt: string;
    token?: string;
}

export type RoleRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** A reader's request to become a contributor. */
export interface RoleRequest {
    id: string;
    requestedRole: 'contributor';
    reason: string;
    portfolio: string | null;
    status: RoleRequestStatus;
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
}

/** GET /me/role-request */
export interface RoleRequestState {
    request: RoleRequest | null;
    canRequest: boolean;
    /** Days left before a rejected reader may ask again. */
    retryAfterDays: number;
}

/** A request as admins see it, with the applicant. */
export interface RoleRequestListItem extends RoleRequest {
    user: { id: string; username: string; displayName: string | null; avatar: string | null; role: UserRole; createdAt: string };
    reviewer: { username: string; displayName: string | null } | null;
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


export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportTargetType = 'comic' | 'comment';

export interface Report {
    id: string;
    reason: string;
    details: string | null;
    status: ReportStatus;
    createdAt: string;
    updatedAt: string;
    reporter?: { username: string | null; displayName: string | null };
    target?: {
        type: ReportTargetType;
        id: string;
        /** The comic's name (for a comment: the comic it belongs to). */
        title: string | null;
        /** The comment text, for comment reports. */
        content: string | null;
        /** Frontend path to the reported item. */
        path: string | null;
    };
}
