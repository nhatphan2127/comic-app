import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderDown, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { API_BASE_URL, API_ORIGIN } from '../../../services/api';
import { CONTENT_RATING_OPTIONS, DEMOGRAPHIC_OPTIONS, FORMAT_OPTIONS, GENRE_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from '../../../constants/comicOptions';
import Segmented from '../../../components/Segmented/Segmented';
import Page, { Card } from '../../../console/ui/Page';
import CodeBlock from '../../../console/ui/CodeBlock';
import { useConsole } from '../../../console/ConsoleContext';
import { SCRIPTS, type Lang } from './scripts';
import style from './ApiGuide.module.css';

const lower = (values: readonly string[]) => values.map((v) => v.toLowerCase()).join(', ');

const TREE = `Solo Leveling/                ← one folder per comic, from Comic folders
├── comic.json                ← comic details, has "id" for comics already on the site
├── cover.jpg                 ← only used when creating a new comic
├── Chapter 1/                ← the first number in the name is the chapter number
│   ├── 001.jpg               ← pages, uploaded in natural order (1, 2 … 10)
│   ├── 002.jpg
│   └── …
├── Chapter 2 - The Return/   ← text after " - " becomes the chapter title
└── 12.5/                     ← a bare number works too, decimals allowed`;

const RULES: [string, string][] = [
  ['Chapter folder', 'The first number in its name is the chapter number. Text after " - " is the title, otherwise "Chapter <number>". Folders without a number are ignored.'],
  ['Pages', 'JPG, PNG, WEBP or GIF, up to 100 per chapter and 10 MB each, in natural order of their file names. Other files are ignored.'],
  ['comic.json with "id"', 'A comic already on the site: the script only uploads chapters to it. Editing the details or the cover here changes nothing.'],
  ['comic.json without "id"', 'A new comic (start from the template in Comic folders): created from the file and cover.*, then the script writes the new "id" into comic.json so a second run never creates it twice.'],
  ['Re-running', 'Chapters that already exist are skipped, and the script waits out rate limits, so just run it again after an error.'],
];

const CURL = `curl -H "Authorization: Bearer $INKVERSE_API_KEY" ${API_BASE_URL}/publish/whoami

curl -X POST ${API_BASE_URL}/publish/comics/<comic id>/chapters \\
  -H "Authorization: Bearer $INKVERSE_API_KEY" \\
  -F chapterNumber=1 -F title="I'm Used to It" \\
  -F pages=@001.jpg -F pages=@002.jpg -F pages=@003.jpg`;

const COMIC_FIELDS: [string, string, string][] = [
  ['name', 'required', 'Title, up to 200 characters.'],
  ['type', 'required', lower(TYPE_OPTIONS)],
  ['demographic', 'required', lower(DEMOGRAPHIC_OPTIONS)],
  ['contentRating', 'required', lower(CONTENT_RATING_OPTIONS)],
  ['cover', 'required', 'Image file (JPEG, PNG, WEBP, GIF; max 10 MB).'],
  ['url', 'optional', 'Slug: lowercase letters, digits, dashes. Made from the name when omitted. Must be unique.'],
  ['releaseStatus', 'optional', `${lower(STATUS_OPTIONS)} (default releasing)`],
  ['releasingYear', 'optional', 'e.g. 2018'],
  ['author, artist', 'optional', 'Names, created when new.'],
  ['genres', 'optional', `Comma-separated: ${GENRE_OPTIONS.join(', ')}`],
  ['formats', 'optional', `Comma-separated: ${FORMAT_OPTIONS.join(', ')}`],
  ['description, source', 'optional', 'Synopsis (max 5000) and where it comes from (max 500).'],
];

const CHAPTER_FIELDS: [string, string, string][] = [
  ['{comic} in the URL', 'required', "The comic's url slug or id. Unreviewed comics only accept chapters from their own contributors."],
  ['chapterNumber', 'required', 'Number, decimals allowed (12.5). One live chapter per number.'],
  ['pages', 'required', 'Up to 100 image files, sent in reading order (the server numbers them as they arrive).'],
  ['title', 'optional', 'Defaults to "Chapter <number>".'],
  ['url', 'optional', 'Defaults to "<comic-url>-chapter-<number>".'],
];

const ERRORS: [string, string][] = [
  ['400', 'A field is missing or invalid; `detail` says which.'],
  ['401', 'Key missing, wrong, expired or revoked.'],
  ['403', 'Key lacks the scope, or the account lost contributor access / was banned.'],
  ['404', 'Comic not found (or not open to you yet).'],
  ['409', 'Comic url or chapter number already exists. Safe to skip when re-running a batch.'],
  ['413 / 415', 'Image over 10 MB, or not a real JPEG/PNG/WEBP/GIF (contents are checked).'],
  ['429', 'Rate limit: 60 uploads per account per 10 minutes (all your keys together), and 10 new comics per hour (Studio included). Wait for `Retry-After` seconds.'],
];

/** /studio/api-guide: how contributors publish from scripts. */
export default function ApiGuideModule() {
  const { to } = useConsole();
  const [lang, setLang] = useState<Lang>('python');
  const script = SCRIPTS[lang];

  return (
    <Page
      title="Publishing API"
      description="Upload whole series from your computer instead of one chapter at a time in the browser. Everything you publish still goes through review."
      actions={
        <Link to={to('api-keys')} className="btn btn--primary">
          <KeyRound size={15} />
          Manage keys
        </Link>
      }
    >
      <ol className={style.steps}>
        <li className={style.step}>
          <span className={style.stepIcon}>
            <KeyRound size={18} />
          </span>
          <strong>1. Create a key</strong>
          <span>
            In <Link to={to('api-keys')}>API keys</Link>. It's shown once, so copy it right away.
          </span>
        </li>
        <li className={style.step}>
          <span className={style.stepIcon}>
            <FolderDown size={18} />
          </span>
          <strong>2. Get the comic folder</strong>
          <span>
            Download it from <Link to={to('comic-folders')}>Comic folders</Link>, then drop chapter folders full of pages into it.
          </span>
        </li>
        <li className={style.step}>
          <span className={style.stepIcon}>
            <Terminal size={18} />
          </span>
          <strong>3. Copy the script and run it</strong>
          <span>Point it at one or more comic folders. No other options needed.</span>
        </li>
      </ol>

      <Card title="Folder layout">
        <pre className={`${style.tree} mono`}>{TREE}</pre>
        <table className={style.table}>
          <tbody>
            {RULES.map(([rule, text]) => (
              <tr key={rule}>
                <th>{rule}</th>
                <td>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title="Uploader script"
        actions={<Segmented ariaLabel="Language" value={lang} onChange={setLang} options={(Object.keys(SCRIPTS) as Lang[]).map((l) => ({ value: l, label: SCRIPTS[l].label }))} />}
      >
        <p className={style.note}>
          Save the script as <code className="mono">{script.file}</code>, keep the key in an environment variable (never inside the script), and run it.
        </p>
        <CodeBlock label="1. setup" code={script.setup} />
        <CodeBlock label={`2. ${script.file}`} code={script.code} className={style.script} />
        <CodeBlock label="3. run" code={script.run} />
      </Card>

      <Card title="Endpoints">
        <p className={style.note}>
          Base URL <code className="mono">{API_BASE_URL}</code>. Send <code className="mono">Authorization: Bearer ink_…</code> and{' '}
          <code className="mono">multipart/form-data</code>. Full schema in the{' '}
          <a href={`${API_ORIGIN}/api/docs/#/Publishing`} target="_blank" rel="noreferrer">
            interactive docs
          </a>
          .
        </p>
        <div className={style.endpoint}>
          <span className={style.method}>GET</span>
          <code className="mono">/publish/whoami</code>
          <span>Which account and scopes a key has.</span>
        </div>

        <div className={style.endpoint}>
          <span className={style.method}>POST</span>
          <code className="mono">/publish/comics</code>
          <span>Create a comic. Needs the comics:write scope.</span>
        </div>
        <FieldTable rows={COMIC_FIELDS} />

        <div className={style.endpoint}>
          <span className={style.method}>POST</span>
          <code className="mono">/publish/comics/{'{comic}'}/chapters</code>
          <span>Upload a chapter. Needs the chapters:write scope.</span>
        </div>
        <FieldTable rows={CHAPTER_FIELDS} />

        <CodeBlock label="curl" code={CURL} />
        <CodeBlock
          label="201 response"
          code={`{
  "data": {
    "id": "8c1e…", "chapterNumber": 1, "title": "I'm Used to It", "pages": 42,
    "url": "solo-leveling-chapter-1", "status": "pending",
    "comic": { "id": "f3a0…", "url": "solo-leveling", "name": "Solo Leveling" }
  }
}`}
        />
      </Card>

      <Card title="Errors">
        <p className={style.note}>
          Errors are JSON (<code className="mono">application/problem+json</code>) with a readable <code className="mono">detail</code>.
        </p>
        <table className={style.table}>
          <tbody>
            {ERRORS.map(([code, text]) => (
              <tr key={code}>
                <th className="mono">{code}</th>
                <td>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Keeping your key safe">
        <ul className={style.safety}>
          <li>
            <ShieldCheck size={16} />A key can only create comics and upload chapters. It cannot sign in, read messages or change your account.
          </li>
          <li>
            <ShieldCheck size={16} />
            Keep it in an environment variable or a password manager. Never paste it in a script you share or commit to Git.
          </li>
          <li>
            <ShieldCheck size={16} />
            Use one key per computer or script, with only the permissions it needs, so you can revoke one without breaking the others.
          </li>
          <li>
            <ShieldCheck size={16} />
            If a key leaks, revoke it in <Link to={to('api-keys')}>API keys</Link>. It stops working immediately. Keys also expire on their own.
          </li>
        </ul>
      </Card>
    </Page>
  );
}

function FieldTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <table className={style.table}>
      <tbody>
        {rows.map(([field, need, text]) => (
          <tr key={field}>
            <th className="mono">{field}</th>
            <td>
              <span className={need === 'required' ? style.required : style.optional}>{need}</span>
            </td>
            <td>{text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
