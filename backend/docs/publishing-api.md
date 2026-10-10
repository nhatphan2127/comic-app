# Publishing API

Lets contributors create comics and upload chapters from scripts instead of the Studio form.
User-facing guide: Studio → **API guide** (`/studio/api-guide`). Sample clients:
`frontend/public/developers/inkverse_publish.py` (Python + requests) and `inkverse-publish.mjs` (Node 20+, no deps).

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/publish/whoami` | API key | Check a key |
| POST | `/api/v1/publish/comics` | API key, `comics:write` | Create a comic (multipart, `cover` file) |
| POST | `/api/v1/publish/comics/{comic}/chapters` | API key, `chapters:write` | Upload a chapter (multipart, `pages` files in order); `{comic}` = id or url slug |
| POST | `/api/v1/publish/bulk` | API key, `bulk:write` (admins) | Import a zip of comic folders in one request (multipart, `archive`) |
| GET / POST | `/api/v1/me/api-keys` | session | List / create keys (create needs the password) |
| DELETE | `/api/v1/me/api-keys/{keyId}` | session | Revoke |

Field-level details are in `src/docs/openapi.yaml` (tag *Publishing*) and at `/api/docs`.

## Bulk import (admins)

An admin creates a key with the `bulk:write` scope (Studio → API keys → *Bulk import*; it is never part
of the default scopes and is refused to non-admins) and sends a whole library as one zip:

```
library.zip
└── One Piece/                     any folder with a comic.json is a comic, at any depth
    ├── comic.json                 same fields as POST /publish/comics ("genres" may be an array)
    ├── cover.jpg                  only needed when the comic is new
    ├── Chapter 1 - Romance Dawn/  first number = chapter number, text after " - " = title
    │   ├── 001.jpg                pages in natural order (2.jpg before 10.jpg)
    │   └── 002.jpg
    └── Chapter 2/
```

```bash
curl -H "Authorization: Bearer $INKVERSE_API_KEY" -F archive=@library.zip http://localhost:5000/api/v1/publish/bulk
```

It is the same folder layout as the uploader scripts, so a folder prepared for them can be zipped as is.
The answer is `200` with `summary` (counts) and one entry per comic and chapter: `created`, `existing`
(comic), `skipped` (chapter already there, or no images) or `failed` with `httpStatus` and `reason`.

- **Re-runnable.** A comic is matched by `comic.json` `id`, else by `url` (or the slug of `name`); an existing
  one receives the chapters instead of being created again, and existing chapter numbers are skipped
  before anything is unpacked. After a partial failure, fix the folder and send the same zip again.
- **Independent items.** Each comic and chapter is created in its own transaction through `publishService`,
  i.e. the same validation and moderation as a single upload (`pending` unless auto-approve is on). A failed
  one deletes its own files; the others are kept. Only an unexpected error (database, disk) stops the import.
- **Checked before unpacking.** Entry count, declared sizes, path names (yauzl rejects absolute paths and
  `..`), then every image's bytes. Stored files get random names and the extension of their real type.
  The zip itself goes to the OS temp folder, never under `/storage`, and is deleted after the request.

## Security design

| Risk | Mitigation |
|---|---|
| Key leaks from the database | Only `SHA-256(key)` is stored. Keys are 256-bit random, so a fast hash is enough. |
| Key guessing / timing | Lookup by public prefix, then `crypto.timingSafeEqual`; a dummy comparison runs when the prefix doesn't exist. Rejected keys are rate limited per IP (20 / 15 min). |
| Leaked key used for more than publishing | Keys are accepted **only** on `/publish`; session tokens are **not** accepted there. Scopes (`comics:write`, `chapters:write`) narrow a key further. |
| Stolen session mints a long-lived key | Creating a key asks for the password again (rate limited 10 / 15 min per user), and the owner gets a notification. |
| Owner loses access | Role and ban are read from `users` on every request: demoted or banned users' keys stop working at once, and `bulk:write` only counts while the owner is still an admin. Password reset revokes all keys. |
| Forgotten keys | Mandatory expiry (30/90/180/365 days), max 10 active keys, `lastUsedAt` / `lastUsedIp` shown in the Studio, one-click revoke. |
| Flooding the queue or disk | 60 uploads per key per 10 min (`PUBLISH_RATE_LIMIT`), 429 with `Retry-After`. Auth and scope are checked **before** multer writes anything. 10 MB per image, 100 pages per chapter. |
| Malicious files | Declared MIME must be JPEG/PNG/WEBP/GIF (no SVG) **and** the file's magic bytes must match; stored names are random UUIDs. Failed requests delete their uploads. |
| Bad or spammy metadata | Strict validation: enums, lengths, slug pattern, year range; genres/formats must come from the fixed vocabulary (the API never creates new ones). Duplicate comic url / chapter number → 409. |
| Bypassing review | Uploads go through the same services as the Studio: `pending` unless an admin enabled auto-approve; unreviewed comics only accept chapters from their own contributors. |

Keys use the `ink_<12 hex>_<43 base64url>` format so leaked keys are easy to spot (e.g. by secret scanners).

## Environment

- `PUBLISH_RATE_LIMIT` — uploads per key per 10 minutes (default 60).
- `PUBLISH_BAD_KEY_LIMIT` — rejected keys per IP per 15 minutes (default 20).
- `PUBLISH_BULK_RATE_LIMIT` — bulk imports per key per hour (default 10).
- `BULK_MAX_ARCHIVE_MB` (default 2048), `BULK_MAX_UNCOMPRESSED_MB` (default 4096), `BULK_MAX_ENTRIES` (default 20000).
- `REQUEST_TIMEOUT_MS` — how long a request body may take to arrive (default 30 minutes; Node's own default is 5).
