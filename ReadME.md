Here is the English version of the project restructuring proposal and the updated API documentation (`README.md`):

---

### I. Proposed Standard Directory Structure (MVC Pattern)

To ensure the project operates smoothly and remains easily scalable, it is recommended to organize the directories using the standard structure below:

```text
comic-platform/
├── data/                         # Directory containing SQLite database files
│   └── comic-platform.sqlite
├── src/                          # Main source code directory
│   ├── config/                   # System configuration and DB connection
│   │   └── database.js
│   ├── controllers/              # Business logic and HTTP request handlers
│   │   ├── authController.js
│   │   ├── comicController.js
│   │   ├── interactionController.js
│   │   ├── commentController.js
│   │   ├── notificationController.js
│   │   ├── moderationController.js
│   │   └── uploadController.js
│   ├── middlewares/              # Middlewares (Authentication, File Upload, Error Handling)
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── uploadMiddleware.js
│   ├── routes/                   # API routes
│   │   ├── authRoutes.js
│   │   ├── comicRoutes.js
│   │   ├── interactionRoutes.js
│   │   ├── commentRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── moderationRoutes.js
│   │   └── uploadRoutes.js
│   └── app.js                    # Express application initialization file
├── scripts/                      # Automation scripts (Seeding, Migrations)
│   └── seed.js
├── storage/                      # Static physical file storage
│   ├── comics/                   # Stores comic cover images (coverUrl)
│   └── chapter-images/           # Stores comic page images (urlPath)
├── package.json
└── README.md                     # Instruction manual and API specifications
```

---

### II. Updated API Specification Document (`README.md`)

The API documentation has been fully updated to standardized JSON response formats, ensuring that all responses are wrapped with a `"status": "success"` or `"status": "fail"` attribute.

# Comic Platform API Documentation

Technical specifications for the RESTful API endpoints of the Comic Platform system.

To ensure consistency during Frontend integration, all response payloads from the system must adhere to the following standardized wrapper structure:
- **Success**: `{ "status": "success", "data": { ... } }` or `{ "status": "success", "message": "..." }`
- **Fail**: `{ "status": "fail", "message": "Detailed error message" }`

---

## API Categorization

### 1. Authentication & User Profile APIs

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/auth/register` | Register a new user account | POST | **Body:** `userName`, `password`, `email`, `displayName` <br>**Response (201 Created):** <br>`{ "status": "success", "data": { "id": "uuid", "userName": "user1", "displayName": "John Doe", "role": "user", "createdAt": "2026-07-01T21:00:00Z" } }` |
| `/auth/login` | Authenticate credentials and create a session | POST | **Body:** `userName`, `password` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "token": "jwt_token_string", "expiresAt": "2026-07-31T21:00:00Z", "user": { "id": "uuid", "userName": "user1", "role": "user" } } }` |
| `/auth/logout` | Log out and invalidate the current token | POST | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Logged out successfully" }` |
| `/user/profile` | View profile and personal settings | GET | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "id": "uuid", "avatar": null, "displayName": "John Doe", "email": "user1@example.com", "bio": "Reader", "socialLinks": null, "role": "user", "preference": { "theme": "light", "filter": 1 } } }` |
| `/user/profile` | Update personal profile information | PUT | **Header:** `Authorization: Bearer {token}` <br>**Body:** `avatar`, `displayName`, `email`, `bio`, `socialLinks` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "avatar": "new_url", "displayName": "John Doe Updated", "bio": "Updated bio" } }` |
| `/user/preferences` | Modify content filter and display theme preferences | PUT | **Header:** `Authorization: Bearer {token}` <br>**Body:** `theme`, `filter` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "theme": "dark", "filter": 2 } }` |

---

### 2. Comic & Chapter APIs

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/comics` | Get a paginated and filtered list of comics | GET | **Query Params:** `page`, `types`, `releaseStatus` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "comics": [ { "id": "uuid", "name": "Peerless Martial God", "types": "manhua", "coverUrl": "comics/uuid.png", "view": 10500, "follow": 120, "url": "peerless-martial-god", "latestChapters": [ { "id": "uuid", "chapterNumber": 5, "title": "Chapter 5" } ] } ], "pagination": { "page": 1, "totalPages": 10 } } }` |
| `/comics/popular` | Retrieve the top 10 most popular comics | GET | **Response (200 OK):** <br>`{ "status": "success", "data": [ { "id": "uuid", "name": "Peerless Martial God", "view": 150000, "url": "peerless-martial-god" } ] }` |
| `/comics/title/{Comic.url}` | View detailed information for a specific comic series | GET | **Response (200 OK):** <br>`{ "status": "success", "data": { "id": "uuid", "name": "Peerless Martial God", "description": "Description...", "author": "Author Name", "artist": "Artist Name", "genres": ["Action", "Fantasy"], "chapters": [ { "id": "uuid", "chapterNumber": 1, "title": "A New Journey" } ] } }` |
| `/comics/title/{Comic.url}/{Chapter.url}` | Read a chapter and load the page images | GET | **Header:** `Authorization: Bearer {token}` (Optional) <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "id": "uuid", "chapterNumber": 1, "title": "A New Journey", "images": [ { "pageNumber": 1, "urlPath": "chapter-images/uuid.png" } ], "readHistory": { "scrollPosition": 150 } } }` |

---

### 3. Interaction APIs (Follow, Rating, and History)

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/comics/{comicId}/follow` | Follow a comic series | POST | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully followed the comic series" }` |
| `/comics/{comicId}/follow` | Unfollow a comic series | DELETE | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully unfollowed the comic series" }` |
| `/user/following` | Get the list of currently followed comics | GET | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "data": [ { "id": "uuid", "name": "Peerless Martial God" } ] }` |
| `/comics/{comicId}/bookmark` | Bookmark a comic series | POST | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "isBookmarked": true } }` |
| `/comics/{comicId}/bookmark` | Remove a comic from bookmarks | DELETE | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully removed from bookmarks" }` |
| `/user/bookmarks` | Get the user's bookmarked comics | GET | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "data": [ { "id": "uuid", "name": "Peerless Martial God" } ] }` |
| `/comics/{comicId}/rate` | Rate a comic series (Scale: 1-5) | POST | **Header:** `Authorization: Bearer {token}` <br>**Body:** `{ "rating": 5 }` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "comicId": "uuid", "newAverageRating": 4.8 } }` |
| `/chapters/{chapterId}/history` | Save or update reading progress (scroll position) | POST | **Header:** `Authorization: Bearer {token}` <br>**Body:** `{ "scrollPosition": 1200 }` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "chapterId": "uuid", "scrollPosition": 1200, "readAt": "2026-07-01T21:00:00Z" } }` |
| `/user/history` | View reading history list | GET | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "data": [ { "chapterId": "uuid", "comicName": "Peerless Martial God", "scrollPosition": 1200 } ] }` |
| `/user/history/{chapterId}` | Remove a single chapter from reading history | DELETE | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully removed chapter from reading history" }` |
| `/user/history` | Clear the entire reading history | DELETE | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully cleared all reading history" }` |

---

### 4. Comment & Reaction APIs

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/comics/{comicId}/comments` | Get the comment list for a comic series | GET | **Query Params:** `page` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "comments": [ { "id": "uuid", "content": "This comic is awesome!", "likes": 20, "dislikes": 2, "user": { "displayName": "John Doe" } } ] } }` |
| `/comics/{comicId}/comments` | Post a new comment or reply to an existing one | POST | **Header:** `Authorization: Bearer {token}` <br>**Body:** `content`, `parentCommentId` (Optional) <br>**Response (201 Created):** <br>`{ "status": "success", "data": { "id": "uuid", "content": "This comic is awesome!", "parentCommentId": null } }` |
| `/comics/comments/{commentId}` | Edit own comment content | PATCH | **Header:** `Authorization: Bearer {token}` <br>**Body:** `content` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "id": "uuid", "content": "Updated content" } }` |
| `/comics/comments/{commentId}` | Delete own comment | DELETE | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Comment deleted successfully" }` |
| `/comics/comments/{commentId}/react` | React to a comment (Like/Dislike) | POST | **Header:** `Authorization: Bearer {token}` <br>**Body:** `{ "reactionType": "like" }` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "commentId": "uuid", "reactionType": "like", "likesCount": 21, "dislikesCount": 2 } }` |
| `/comics/comments/{commentId}/react` | Remove reaction from a comment | DELETE | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully removed reaction from comment" }` |
| *(Similar APIs for Chapters)* | Handle chapter comments and replies | - | Apply similarly to `/chapters/{chapterId}/comments` and `/chapters/comments/{commentId}` routes. |

---

### 5. Notification APIs

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/notifications` | Get user notifications | GET | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "data": [ { "id": "uuid", "title": "System Upgrade", "content": "Content...", "type": "system", "isRead": 0 } ] }` |
| `/notifications/{id}/read` | Mark a notification as read | PATCH | **Header:** `Authorization: Bearer {token}` <br>**Response (200 OK):** <br>`{ "status": "success", "message": "Successfully marked notification as read" }` |

---

### 6. Admin Moderation & Permission APIs

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/admin/users/{userId}/role` | Assign a new system role to a user | PATCH | **Header:** `Authorization: Bearer {token}` (Admin required) <br>**Body:** `{ "role": "moderator" }` <br>**Response (200 OK):** <br>`{ "status": "success", "data": { "userId": "uuid", "role": "moderator" } }` |
| `/admin/comments/comics/{commentId}` | Administrator force-deletion of a comic comment | DELETE | **Header:** `Authorization: Bearer {token}` (Admin/Moderator required) <br>**Response (200 OK):** <br>`{ "status": "success", "message": "The comment was force-removed by the administration team" }` |
| `/admin/comments/chapters/{commentId}` | Administrator force-deletion of a chapter comment | DELETE | **Header:** `Authorization: Bearer {token}` (Admin/Moderator required) <br>**Response (200 OK):** <br>`{ "status": "success", "message": "The chapter comment was force-removed by the administration team" }` |

---

### 7. Content Creation & Upload APIs

| API | Description | Method | Payload / Response |
|:---|:---|:---:|:---|
| `/comics` | Create a new comic entry with metadata | POST | **Header:** `Authorization: Bearer {token}` (Contributor/Admin required) <br>**Body (Multipart/Form-Data):** <br>- `name` (String, Required)<br>- `types` (String, Required - manga/manhwa/manhua/other)<br>- `contentRating` (String, Required - safe/suggestive...) <br>- `demographic` (String, Required) <br>- `description` (String) <br>- `url` (String - unique slug)<br>- `coverImage` (File, Required)<br>- `authorId` (String), `artistId` (String)<br>- `genres` (Array/String - list of genre IDs) <br>**Response (201 Created):** <br>`{ "status": "success", "data": { "id": "uuid", "name": "New Comic", "coverUrl": "comics/uuid.png", "status": "pending" } }` |
| `/comics/{comicId}/chapters` | Publish a new chapter along with an ordered set of page images | POST | **Header:** `Authorization: Bearer {token}` (Contributor/Admin required) <br>**Body (Multipart/Form-Data):** <br>- `title` (String, Required)<br>- `chapterNumber` (Decimal, Required)<br>- `url` (String - unique slug)<br>- `images` (Files, Required - ordered list of page image files) <br>**Response (201 Created):** <br>`{ "status": "success", "data": { "chapterId": "uuid", "chapterNumber": 1, "title": "A New Journey", "imagesCount": 8 } }` |

*Note: Raw image files are not stored directly in the database. The database only records relative file paths, which can be resolved and retrieved dynamically.*