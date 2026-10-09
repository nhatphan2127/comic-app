// The uploader scripts shown on /studio/api-guide, as text to copy. Both behave the same:
// arguments are comic folders (or a folder of comic folders), everything else comes from the folder layout.
import { API_BASE_URL } from '../../../services/api';

export type Lang = 'python' | 'node';

const PYTHON = `#!/usr/bin/env python3
"""Inkverse uploader. Usage: python inkverse.py <comic folder>... (or a folder that holds comic folders)"""
import json, os, re, sys, time
from pathlib import Path
import requests

API = os.environ.get("INKVERSE_API_URL", "${API_BASE_URL}").rstrip("/")
KEY = os.environ.get("INKVERSE_API_KEY") or sys.exit("Set INKVERSE_API_KEY first")
IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
FIELDS = ["name", "url", "type", "demographic", "contentRating", "releaseStatus",
          "releasingYear", "author", "artist", "description", "source"]
stats = {"uploaded": 0, "skipped": 0, "failed": 0}

def natural(p):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\\d+)", p.name)]

def call(method, path, data=None, files=()):
    while True:  # files are reopened on every try, so a 429 retry sends them again
        handles = [(field, (p.name, open(p, "rb"))) for field, p in files]
        try:
            r = requests.request(method, API + path, data=data, files=handles or None, timeout=600,
                                 headers={"Authorization": f"Bearer {KEY}"})
        finally:
            for _, (_, f) in handles:
                f.close()
        if r.status_code != 429:
            return r
        wait = int(r.headers.get("Retry-After", 60))
        print(f"  rate limited, waiting {wait}s")
        time.sleep(wait)

def detail(r):
    try:
        return r.json().get("detail") or r.text
    except ValueError:
        return r.text

def create_comic(folder, info):
    cover = next((p for p in folder.iterdir() if p.stem.lower() == "cover" and p.suffix.lower() in IMAGES), None)
    if not cover:
        return print("  ! a new comic needs a cover.jpg / .png / .webp next to comic.json")
    data = {k: info[k] for k in FIELDS if info.get(k) not in (None, "")}
    for k in ("genres", "formats"):
        v = info.get(k) or []
        data[k] = v if isinstance(v, str) else ", ".join(v)
    r = call("POST", "/publish/comics", data, [("cover", cover)])
    if r.status_code == 409:
        return print("  ! this comic already exists: download its folder from Studio > Comic folders instead")
    if not r.ok:
        return print(f"  ! comic: {r.status_code} {detail(r)}")
    created = r.json()["data"]
    info["id"] = created["id"]  # saved, so running again never creates it twice
    (folder / "comic.json").write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  + comic created ({created['status']})")
    return created["id"]

def publish(folder):
    info = json.loads((folder / "comic.json").read_text(encoding="utf-8"))
    print(f"\\n{info.get('name') or folder.name}")
    comic = info.get("id") or create_comic(folder, info)
    if not comic:
        stats["failed"] += 1
        return
    chapters = []
    for d in (d for d in folder.iterdir() if d.is_dir()):
        m = re.search(r"\\d+(?:\\.\\d+)?", d.name)
        if m:
            chapters.append((float(m.group()), m.group(), d.name.partition(" - ")[2].strip(), d))
    for _, number, title, d in sorted(chapters, key=lambda c: c[0]):
        pages = sorted((p for p in d.iterdir() if p.suffix.lower() in IMAGES), key=natural)
        if not pages:
            continue
        data = {"chapterNumber": number, **({"title": title} if title else {})}
        r = call("POST", f"/publish/comics/{comic}/chapters", data, [("pages", p) for p in pages])
        if r.status_code == 409:
            stats["skipped"] += 1
            print(f"  = chapter {number} already exists, skipped")
        elif r.ok:
            stats["uploaded"] += 1
            print(f"  + chapter {number}: {len(pages)} pages")
        else:
            stats["failed"] += 1
            print(f"  ! chapter {number}: {r.status_code} {detail(r)}")

def comic_folders(args):
    for arg in args or ["."]:
        p = Path(arg)
        if (p / "comic.json").is_file():
            yield p
        elif p.is_dir():
            yield from sorted((c for c in p.iterdir() if (c / "comic.json").is_file()), key=natural)
        else:
            print(f"! {arg} is not a folder")

me = call("GET", "/publish/whoami")
if not me.ok:
    sys.exit(f"API key rejected: {detail(me)}")
user = me.json()["data"]["user"]
print("Signed in as", user.get("username") or user.get("name") or user.get("email"))
for folder in comic_folders(sys.argv[1:]):
    publish(folder)
print(f"\\nDone: {stats['uploaded']} uploaded, {stats['skipped']} skipped, {stats['failed']} failed")
`;

const NODE = `// Inkverse uploader. Usage: node inkverse.mjs <comic folder>... (or a folder that holds comic folders)
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = (process.env.INKVERSE_API_URL || '${API_BASE_URL}').replace(/\\/+$/, '');
const KEY = process.env.INKVERSE_API_KEY;
if (!KEY) { console.error('Set INKVERSE_API_KEY first'); process.exit(1); }
const IMAGES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const FIELDS = ['name', 'url', 'type', 'demographic', 'contentRating', 'releaseStatus',
  'releasingYear', 'author', 'artist', 'description', 'source'];
const stats = { uploaded: 0, skipped: 0, failed: 0 };
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;
const isImage = (f) => IMAGES.has(path.extname(f).toLowerCase());
const exists = (p) => stat(p).then(() => true, () => false);
const dirs = async (p) => (await readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

async function call(method, route, fields = {}, files = []) {
  for (;;) {
    let body;
    if (method !== 'GET') {
      body = new FormData();
      for (const [k, v] of Object.entries(fields)) body.append(k, String(v));
      for (const [field, file] of files) body.append(field, new Blob([await readFile(file)]), path.basename(file));
    }
    const res = await fetch(API + route, { method, body, headers: { Authorization: \`Bearer \${KEY}\` } });
    if (res.status !== 429) {
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data: json.data, detail: json.detail || res.statusText };
    }
    const wait = Number(res.headers.get('retry-after')) || 60;
    console.log(\`  rate limited, waiting \${wait}s\`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

async function createComic(folder, info) {
  const cover = (await readdir(folder)).find((f) => isImage(f) && path.parse(f).name.toLowerCase() === 'cover');
  if (!cover) return console.log('  ! a new comic needs a cover.jpg / .png / .webp next to comic.json');
  const fields = Object.fromEntries(FIELDS.filter((k) => info[k] != null && info[k] !== '').map((k) => [k, info[k]]));
  for (const k of ['genres', 'formats']) fields[k] = [].concat(info[k] || []).join(', ');
  const res = await call('POST', '/publish/comics', fields, [['cover', path.join(folder, cover)]]);
  if (res.status === 409) return console.log('  ! this comic already exists: download its folder from Studio > Comic folders instead');
  if (!res.ok) return console.log(\`  ! comic: \${res.status} \${res.detail}\`);
  info.id = res.data.id; // saved, so running again never creates it twice
  await writeFile(path.join(folder, 'comic.json'), JSON.stringify(info, null, 2));
  console.log(\`  + comic created (\${res.data.status})\`);
  return res.data.id;
}

async function publish(folder) {
  const info = JSON.parse(await readFile(path.join(folder, 'comic.json'), 'utf8'));
  console.log(\`\\n\${info.name || path.basename(folder)}\`);
  const comic = info.id || (await createComic(folder, info));
  if (!comic) return void stats.failed++;
  const chapters = (await dirs(folder))
    .map((name) => ({ name, number: name.match(/\\d+(?:\\.\\d+)?/)?.[0], title: name.split(' - ').slice(1).join(' - ').trim() }))
    .filter((c) => c.number)
    .sort((a, b) => a.number - b.number);
  for (const { name, number, title } of chapters) {
    const dir = path.join(folder, name);
    const pages = (await readdir(dir)).filter(isImage).sort(natural);
    if (!pages.length) continue;
    const fields = title ? { chapterNumber: number, title } : { chapterNumber: number };
    const res = await call('POST', \`/publish/comics/\${comic}/chapters\`, fields, pages.map((p) => ['pages', path.join(dir, p)]));
    if (res.status === 409) { stats.skipped++; console.log(\`  = chapter \${number} already exists, skipped\`); }
    else if (res.ok) { stats.uploaded++; console.log(\`  + chapter \${number}: \${pages.length} pages\`); }
    else { stats.failed++; console.log(\`  ! chapter \${number}: \${res.status} \${res.detail}\`); }
  }
}

async function comicFolders(args) {
  const found = [];
  for (const arg of args.length ? args : ['.']) {
    if (await exists(path.join(arg, 'comic.json'))) found.push(arg);
    else if (await exists(arg)) {
      for (const name of (await dirs(arg)).sort(natural)) {
        if (await exists(path.join(arg, name, 'comic.json'))) found.push(path.join(arg, name));
      }
    } else console.log(\`! \${arg} is not a folder\`);
  }
  return found;
}

const me = await call('GET', '/publish/whoami');
if (!me.ok) {
  console.error(\`API key rejected: \${me.detail}\`);
  process.exitCode = 1; // not process.exit(): it can crash Node on Windows while fetch sockets are open
} else {
  console.log('Signed in as', me.data.user.username || me.data.user.name || me.data.user.email);
  for (const folder of await comicFolders(process.argv.slice(2))) await publish(folder);
  console.log(\`\\nDone: \${stats.uploaded} uploaded, \${stats.skipped} skipped, \${stats.failed} failed\`);
}
`;

export const SCRIPTS: Record<Lang, { label: string; file: string; setup: string; code: string; run: string }> = {
  python: {
    label: 'Python',
    file: 'inkverse.py',
    setup: `pip install requests

# macOS / Linux
export INKVERSE_API_KEY="ink_..."
# Windows PowerShell
$env:INKVERSE_API_KEY="ink_..."`,
    code: PYTHON,
    run: `# One comic
python inkverse.py "./Solo Leveling"

# Several comics
python inkverse.py "./Solo Leveling" "./Tower of God"

# Every comic folder inside a library folder
python inkverse.py "./library"`,
  },
  node: {
    label: 'Node.js',
    file: 'inkverse.mjs',
    setup: `# Node.js 18+, nothing to install

# macOS / Linux
export INKVERSE_API_KEY="ink_..."
# Windows PowerShell
$env:INKVERSE_API_KEY="ink_..."`,
    code: NODE,
    run: `# One comic
node inkverse.mjs "./Solo Leveling"

# Several comics
node inkverse.mjs "./Solo Leveling" "./Tower of God"

# Every comic folder inside a library folder
node inkverse.mjs "./library"`,
  },
};
