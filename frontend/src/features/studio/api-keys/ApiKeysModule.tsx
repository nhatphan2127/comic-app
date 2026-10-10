import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, KeyRound, Plus, Trash2 } from 'lucide-react';
import { apiKeyApi } from '../../../services/api';
import type { ApiKey, ApiKeyScope } from '../../../types/types';
import { useToast } from '../../../context/ToastContext';
import { formatTimeAgo } from '../../../helpers/formatDate';
import Modal from '../../../components/Modal/Modal';
import Page, { Notice, PageState } from '../../../console/ui/Page';
import ManageRow, { ManageList } from '../../../console/ui/ManageRow';
import CodeBlock from '../../../console/ui/CodeBlock';
import { useConsole } from '../../../console/ConsoleContext';
import { useAuth } from '../../../context/AuthContext';
import cx from '../../../helpers/cx';
import style from './ApiKeys.module.css';

const SCOPES: { value: ApiKeyScope; label: string; hint: string; adminOnly?: boolean }[] = [
  { value: 'comics:write', label: 'Create comics', hint: 'POST /publish/comics' },
  { value: 'chapters:write', label: 'Upload chapters', hint: 'POST /publish/comics/{comic}/chapters' },
  { value: 'bulk:write', label: 'Bulk import (zip of comic folders)', hint: 'POST /publish/bulk · admins only', adminOnly: true },
];
// bulk:write is opt-in, like on the server.
const DEFAULT_SCOPES = SCOPES.filter((s) => !s.adminOnly).map((s) => s.value);
const EXPIRY = [30, 90, 180, 365];
const STATUS_BADGE: Record<ApiKey['status'], string> = { active: 'badge--ok', expired: 'badge--warn', revoked: 'badge--err' };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** /studio/api-keys: personal keys for the publishing API. */
export default function ApiKeysModule() {
  const toast = useToast();
  const { to } = useConsole();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKey | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setKeys(await apiKeyApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (key: ApiKey) => {
    if (!window.confirm(`Revoke "${key.name}"? Scripts using it stop working immediately.`)) return;
    try {
      await apiKeyApi.revoke(key.id);
      toast.success('Key revoked.');
      await load();
    } catch (err) {
      toast.error(err, 'Unable to revoke the key');
    }
  };

  const active = keys.filter((k) => k.status === 'active');
  const inactive = keys.filter((k) => k.status !== 'active');

  const renderKey = (key: ApiKey) => (
    <ManageRow
      key={key.id}
      leading={
        <span className={cx(style.keyIcon, key.status !== 'active' && style.keyIconOff)}>
          <KeyRound size={18} />
        </span>
      }
      title={
        <span className={style.title}>
          {key.name}
          <span className={cx('badge', STATUS_BADGE[key.status])}>{key.status}</span>
        </span>
      }
      meta={[
        <code key="hint" className="mono">
          {key.hint}
        </code>,
        key.scopes.join(' · '),
        key.status === 'revoked' && key.revokedAt ? `Revoked ${formatTimeAgo(key.revokedAt)}` : `Expires ${formatDate(key.expiresAt)}`,
        key.lastUsedAt ? `Last used ${formatTimeAgo(key.lastUsedAt)}${key.lastUsedIp ? ` from ${key.lastUsedIp}` : ''}` : 'Never used',
      ]}
      actions={
        key.status === 'active' ? (
          <button type="button" className="btn btn--danger btn--sm" onClick={() => void revoke(key)}>
            <Trash2 size={14} />
            Revoke
          </button>
        ) : null
      }
    />
  );

  return (
    <Page
      title="API keys"
      description="Let your own scripts create comics and upload chapters through the publishing API. A key can only publish; it can't sign in or change your account."
      actions={
        <>
          <Link to={to('api-guide')} className="btn btn--ghost">
            <BookOpen size={15} />
            API guide
          </Link>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            New key
          </button>
        </>
      }
    >
      <PageState
        loading={loading}
        error={error}
        empty={keys.length === 0}
        emptyTitle="No keys yet"
        emptyText="Create a key, then follow the API guide to upload from Python or Node.js."
      >
        {active.length ? <ManageList>{active.map(renderKey)}</ManageList> : <Notice tone="info">You have no active keys.</Notice>}
        {inactive.length ? (
          <details className={style.history}>
            <summary>Expired and revoked keys ({inactive.length})</summary>
            <ManageList>{inactive.map(renderKey)}</ManageList>
          </details>
        ) : null}
      </PageState>

      <CreateKeyModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={(key) => {
          setCreating(false);
          setCreated(key);
          void load();
        }}
      />
      <NewKeyModal apiKey={created} onClose={() => setCreated(null)} guidePath={to('api-guide')} />
    </Page>
  );
}

function CreateKeyModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (key: ApiKey) => void }) {
  const [name, setName] = useState('');
  const isAdmin = useAuth().user?.role === 'admin';
  const scopeOptions = SCOPES.filter((s) => isAdmin || !s.adminOnly);
  const [scopes, setScopes] = useState<ApiKeyScope[]>(DEFAULT_SCOPES);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setScopes(DEFAULT_SCOPES);
    setExpiresInDays(90);
    setPassword('');
    setError(null);
  }, [isOpen]);

  const toggleScope = (scope: ApiKeyScope) => setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onCreated(await apiKeyApi.create({ name: name.trim(), password, scopes, expiresInDays }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} size="sm" title="New API key" subtitle="Give each script or computer its own key.">
      <form className={style.form} onSubmit={submit}>
        <label className={style.field}>
          <span>Name</span>
          <input className="input" maxLength={60} placeholder="e.g. Laptop upload script" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <fieldset className={style.field}>
          <span>Permissions</span>
          {scopeOptions.map((s) => (
            <label key={s.value} className={style.check}>
              <input type="checkbox" checked={scopes.includes(s.value)} onChange={() => toggleScope(s.value)} />
              <span>
                {s.label}
                <small className="mono">{s.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <label className={style.field}>
          <span>Expires after</span>
          <select className="input" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))}>
            {EXPIRY.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>

        <label className={style.field}>
          <span>Your password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <small className={style.help}>Keys work without signing in, so we ask for your password again.</small>
        </label>

        {error ? <Notice tone="err">{error}</Notice> : null}

        <div className={style.actions}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !name.trim() || !password || scopes.length === 0}>
            {saving ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Shows the full key once, right after it was created. */
function NewKeyModal({ apiKey, onClose, guidePath }: { apiKey: ApiKey | null; onClose: () => void; guidePath: string }) {
  if (!apiKey?.token) return null;
  return (
    <Modal isOpen onClose={onClose} size="md" title="Copy your key now" subtitle={apiKey.name}>
      <div className={style.reveal}>
        <div className={style.warning}>
          <AlertTriangle size={18} />
          <span>This is the only time the full key is shown. Store it somewhere safe, like a password manager or an environment variable. Never commit it to Git.</span>
        </div>
        <CodeBlock label="API key" code={apiKey.token} />
        <p className={style.help}>Check that it works:</p>
        <CodeBlock
          label="bash"
          code={`export INKVERSE_API_KEY="${apiKey.token}"\npython inkverse_publish.py whoami`}
        />
        <div className={style.actions}>
          <Link to={guidePath} className="btn btn--ghost" onClick={onClose}>
            Open the API guide
          </Link>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            I've stored it
          </button>
        </div>
      </div>
    </Modal>
  );
}
