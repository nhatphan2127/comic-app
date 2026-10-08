import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Camera, Lock, Mail, X } from 'lucide-react';
import { userApi } from '../../../../services/api';
import { resolveUploadUrl } from '../../../../helpers/getImage';
import Avatar from '../../../../components/Avatar/Avatar';
import ImageCropper from '../../../../components/ImageCropper/ImageCropper';
import PanelShell from '../PanelShell/PanelShell';
import cx from '../../../../helpers/cx';
import style from './EditProfilePanel.module.css';

const MAX_AVATAR_BYTES = 1024 * 1024;
const MIN_PASSWORD = 6;
const NAME_MAX = 16;
const BIO_MAX = 500;

interface ProfileForm {
  avatar: string;
  displayName: string;
  username: string;
  bio: string;
  socialLinks: string;
  email: string;
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

const EMPTY_FORM: ProfileForm = {
  avatar: '',
  displayName: '',
  username: '',
  bio: '',
  socialLinks: '',
  email: '',
  currentPassword: '',
  password: '',
  confirmPassword: '',
};

type Status = { tone: 'ok' | 'err'; text: string } | null;

function Section({ title, hint, children, wide }: { title: string; hint: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={style.section}>
      <div className={style.sectionHead}>
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>
      <div className={cx(style.sectionBody, wide && style.twoCol)}>{children}</div>
    </section>
  );
}

function Field({ label, hint, icon, children }: { label: string; hint?: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className={style.field}>
      <span className={style.label}>{label}</span>
      <span className={cx(style.control, icon ? style.withIcon : undefined)}>
        {icon ? <span className={style.icon}>{icon}</span> : null}
        {children}
      </span>
      {hint ? <span className={style.hint}>{hint}</span> : null}
    </label>
  );
}

export default function EditProfilePanel() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userApi
      .getProfile()
      .then((data) =>
        setForm({
          ...EMPTY_FORM,
          avatar: data.avatar || '',
          displayName: data.displayName || '',
          username: data.username || '',
          bio: data.bio || '',
          socialLinks: data.socialLinks || '',
          email: data.email || '',
        }),
      )
      .catch((err) => console.error('Unable to load profile:', err));
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setStatus({ tone: 'err', text: 'Kích thước ảnh vượt quá 1MB. Vui lòng chọn ảnh nhẹ hơn.' });
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const { currentPassword, password, confirmPassword, email: _email, ...profile } = form;
    if (password && password.length < MIN_PASSWORD) {
      setStatus({ tone: 'err', text: `Mật khẩu phải chứa ít nhất ${MIN_PASSWORD} ký tự.` });
      return;
    }
    if (password && password !== confirmPassword) {
      setStatus({ tone: 'err', text: 'Mật khẩu xác nhận không trùng khớp.' });
      return;
    }
    if (password && !currentPassword) {
      setStatus({ tone: 'err', text: 'Vui lòng nhập mật khẩu hiện tại.' });
      return;
    }

    setSaving(true);
    try {
      await userApi.updateProfile(profile);
      if (password) await userApi.updatePassword(currentPassword, password, confirmPassword);
      setForm((prev) => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }));
      setStatus({ tone: 'ok', text: 'Cập nhật tài khoản thành công!' });
    } catch (err) {
      setStatus({ tone: 'err', text: err instanceof Error && err.message ? err.message : 'Cập nhật thất bại. Vui lòng thử lại.' });
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = resolveUploadUrl(form.avatar);

  return (
    <PanelShell title="Edit profile" subtitle="Choose how you appear to other readers.">
      <form className={style.form} noValidate onSubmit={submit}>
        <Section title="Avatar" hint="JPG, PNG or WebP · max 1 MB">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickFile} />
          <div className={style.avatarRow}>
            <button type="button" className={style.avatarBtn} aria-label="Change avatar" disabled={saving} onClick={() => fileRef.current?.click()}>
              <Avatar name={form.displayName || form.username || 'User'} src={avatarUrl} size={84} />
              <span className={style.avatarOverlay}>
                <Camera size={20} />
              </span>
            </button>
            <div className={style.avatarActions}>
              <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={() => fileRef.current?.click()}>
                Upload new
              </button>
              {form.avatar ? (
                <button type="button" className="btn btn--danger btn--sm" disabled={saving} onClick={() => setForm((p) => ({ ...p, avatar: '' }))}>
                  <X size={13} />
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </Section>

        <Section title="Identity" hint="Shown on your profile and beside your comments." wide>
          <Field label="Display name" hint={`${form.displayName.length} / ${NAME_MAX}`}>
            <input className="input" name="displayName" maxLength={NAME_MAX} value={form.displayName} onChange={onChange} disabled={saving} />
          </Field>
          <Field label="Username" icon="@" hint="Lowercase letters, digits, dots, dashes and underscores.">
            <input className="input" name="username" maxLength={32} value={form.username} onChange={onChange} disabled={saving} />
          </Field>
        </Section>

        <Section title="About" hint="A few words for your public profile.">
          <Field label="Bio" hint={`${form.bio.length} / ${BIO_MAX}`}>
            <textarea className="input" name="bio" rows={4} maxLength={BIO_MAX} placeholder="What do you like to read?" value={form.bio} onChange={onChange} disabled={saving} />
          </Field>
          <Field label="Links" hint="One URL per line (http/https), up to five.">
            <textarea className="input" name="socialLinks" rows={3} placeholder={'https://example.com\nhttps://social.example/@you'} value={form.socialLinks} onChange={onChange} disabled={saving} />
          </Field>
        </Section>

        <Section title="Account" hint="Your sign-in email can't be changed here." >
          <Field label="Email" icon={<Mail size={14} />}>
            <input className="input" type="email" value={form.email} readOnly aria-readonly="true" />
          </Field>
        </Section>

        <Section title="Password" hint={`Leave empty to keep your current password. At least ${MIN_PASSWORD} characters.`} wide>
          <Field label="Current password" icon={<Lock size={14} />}>
            <input className="input" type="password" name="currentPassword" autoComplete="current-password" placeholder="••••••••" value={form.currentPassword} onChange={onChange} disabled={saving} />
          </Field>
          <Field label="New password" icon={<Lock size={14} />}>
            <input className="input" type="password" name="password" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={onChange} disabled={saving} />
          </Field>
          <Field label="Confirm password" icon={<Lock size={14} />}>
            <input className="input" type="password" name="confirmPassword" autoComplete="new-password" placeholder="••••••••" value={form.confirmPassword} onChange={onChange} disabled={saving} />
          </Field>
        </Section>

        <footer className={style.actions}>
          {status ? (
            <span className={cx(style.status, status.tone === 'ok' ? style.statusOk : style.statusErr)} role="status">
              {status.text}
            </span>
          ) : null}
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </form>

      {cropSrc ? (
        <ImageCropper
          imageSrc={cropSrc}
          onClose={closeCropper}
          onSave={(dataUrl) => {
            setForm((prev) => ({ ...prev, avatar: dataUrl }));
            closeCropper();
          }}
        />
      ) : null}
    </PanelShell>
  );
}
