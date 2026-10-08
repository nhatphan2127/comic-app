import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import { AuthField } from '../AuthForm/AuthForm';
import styles from '../AuthForm/AuthForm.module.css';
import cx from '../../helpers/cx';

type Props = {
  onSwitch: () => void;
  onForgot: () => void;
  onSuccess: () => void;
};

export default function LoginForm({ onSwitch, onForgot, onSuccess }: Props) {
  const { login } = useAuth();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await authApi.login(userName, password);
      login(session.token, session.user);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error ? <div className={cx(styles.alert, styles.alertError)} role="alert">{error}</div> : null}

      <AuthField
        label="Username or email"
        type="text"
        autoComplete="username"
        placeholder="you@domain.com"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        required
        disabled={loading}
      />

      <AuthField
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
        aside={
          <button type="button" className={cx(styles.link, styles.linkSubtle)} onClick={onForgot} disabled={loading}>
            Forgot password?
          </button>
        }
      />

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div className={styles.foot}>
        New here?
        <button type="button" className={styles.link} onClick={onSwitch} disabled={loading}>
          Create an account
        </button>
      </div>
    </form>
  );
}
