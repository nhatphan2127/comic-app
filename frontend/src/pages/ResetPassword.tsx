import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HeaderLayout from '../layout/HeaderLayout/HeaderLayout';
import { authApi } from '../services/api';
import { AuthField } from '../components/AuthForm/AuthForm';
import styles from '../components/AuthForm/AuthForm.module.css';
import cx from '../helpers/cx';
import page from './StandalonePage.module.css';

/** Opened from the reset email: /reset-password?token=… */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match.');
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword(token, password, confirm);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <HeaderLayout />
      <main className={page.wrap}>
        <section className={page.card}>
          <h1 className={page.title}>Choose a new password</h1>

          {!token ? (
            <p className={page.text}>
              This link is missing its token. Open the link from the email again, or request a new one from the sign-in window.
            </p>
          ) : done ? (
            <div className={styles.form}>
              <div className={cx(styles.alert, styles.alertSuccess)}>
                Your password was changed and every device was signed out. Sign in with the new password.
              </div>
              <Link to="/" className={styles.submit}>
                Go to the home page
              </Link>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              {error ? (
                <div className={cx(styles.alert, styles.alertError)} role="alert">
                  {error}
                </div>
              ) : null}
              <AuthField
                label="New password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <AuthField
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={loading}
              />
              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
