import { useState, type FormEvent } from 'react';
import { authApi } from '../../services/api';
import { AuthField } from '../AuthForm/AuthForm';
import styles from '../AuthForm/AuthForm.module.css';
import cx from '../../helpers/cx';

type Props = {
  onBack: () => void;
};

/** Asks for the account email; the server mails a one-time reset link. */
export default function ForgotPasswordForm({ onBack }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.form}>
        {/* Same text whether or not the email exists, like the API. */}
        <div className={cx(styles.alert, styles.alertSuccess)}>
          If an account uses {email.trim()}, a reset link is on its way. It works for 30 minutes.
        </div>
        <button type="button" className={styles.submit} onClick={onBack}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error ? (
        <div className={cx(styles.alert, styles.alertError)} role="alert">
          {error}
        </div>
      ) : null}

      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@domain.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <div className={styles.foot}>
        Remembered it?
        <button type="button" className={styles.link} onClick={onBack} disabled={loading}>
          Back to sign in
        </button>
      </div>
    </form>
  );
}
