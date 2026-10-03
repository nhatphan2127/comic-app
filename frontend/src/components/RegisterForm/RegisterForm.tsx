import React, { useState } from 'react';
import { API_BASE_URL } from '../../context/AuthContext';
import styles from './RegisterForm.module.css'; // Hoặc file CSS chung nếu dùng chung

type Props = { 
  onSwitch: () => void;
  onSuccess: () => void;
};

export default function RegisterForm({ onSwitch, onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: username,
          email: email,
          password: password,
          displayName: username // Tạm thời lấy username làm displayName hiển thị ban đầu
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Đăng ký tài khoản không thành công');
      }

      alert('Tạo tài khoản thành công! Vui lòng đăng nhập.');
      onSuccess(); // Chuyển về tab Login
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình đăng ký';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles['auth__form']} onSubmit={handleSubmit}>
      {error && (
        <div 
          className={styles['error-message']} 
          style={{ color: '#ff4d4f', marginBottom: '1rem', fontSize: '0.9rem' }}
        >
          {error}
        </div>
      )}

      <label className={styles['auth__field']}>
        <span>Username</span>
        <input 
          type="text"
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder="margin_reader" 
          required
          disabled={loading}
        />
      </label>

      <label className={styles['auth__field']}>
        <span>Email</span>
        <input 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="you@domain.com" 
          required
          disabled={loading}
        />
      </label>

      <label className={styles['auth__field']}>
        <span>Password</span>
        <input 
          type="password" 
          placeholder="••••••••" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required
          disabled={loading}
        />
      </label>

      <label className={styles['auth__field']}>
        <span>Confirm Password</span>
        <input 
          type="password" 
          placeholder="••••••••" 
          value={confirm} 
          onChange={(e) => setConfirm(e.target.value)} 
          required
          disabled={loading}
        />
      </label>

      <button type="submit" className={styles['auth__submit']} disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      <div className={styles['auth__or']}>
        <span>or</span>
      </div>

      <div className={styles['auth__socials']}>
        <button type="button" className={styles['auth__social']} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>

      <div className={styles['auth__foot']}>
        <span>Already have an account? </span>
        <button type="button" className={styles['auth__link']} onClick={onSwitch} disabled={loading}>
          Log in
        </button>
      </div>
    </form>
  );
}