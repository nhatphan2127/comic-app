import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import { AuthField } from '../AuthForm/AuthForm';
import styles from '../AuthForm/AuthForm.module.css';
import cx from '../../helpers/cx';

type Props = {
  onSwitch: () => void;
  onSuccess: () => void;
};

const EMPTY_FORM = { username: '', email: '', password: '', confirm: '' };

export default function RegisterForm({ onSwitch, onSuccess }: Props) {
  const { login } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    setLoading(true);
    try {
      await authApi.register(form.username, form.email, form.password, form.username);
      // Sign straight in instead of asking for the password that was just typed.
      const session = await authApi.login(form.username, form.password);
      login(session.user);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình đăng ký');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error ? <div className={cx(styles.alert, styles.alertError)} role="alert">{error}</div> : null}

      <AuthField label="Username" type="text" autoComplete="username" placeholder="night_reader"
        value={form.username} onChange={update('username')} required disabled={loading} />
      <AuthField label="Email" type="email" autoComplete="email" placeholder="you@domain.com"
        value={form.email} onChange={update('email')} required disabled={loading} />
      <AuthField label="Password" type="password" autoComplete="new-password" placeholder="••••••••"
        value={form.password} onChange={update('password')} required disabled={loading} />
      <AuthField label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••"
        value={form.confirm} onChange={update('confirm')} required disabled={loading} />

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <div className={styles.foot}>
        Already have an account?
        <button type="button" className={styles.link} onClick={onSwitch} disabled={loading}>
          Log in
        </button>
      </div>
    </form>
  );
}
