import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LoginForm from '../../components/LoginForm/LoginForm';
import RegisterForm from '../../components/RegisterForm/RegisterForm';
import styles from './AuthModalLayout.module.css';

import { X } from 'lucide-react';

export type AuthMode = 'login' | 'register';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModalLayout({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');

  // Reset trạng thái về 'login' khi modal đóng/mở
  useEffect(() => {
    if (!isOpen) {
      setMode('login');
    }
  }, [isOpen]);

  // Xử lý sự kiện nhấn phím Escape và khóa cuộn nền (body scroll)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Khóa scroll của body
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Trả lại trạng thái scroll ban đầu khi đóng hoặc unmount
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className={styles['auth']} 
      role="dialog" 
      aria-modal="true" 
      onClick={onClose}
    >
      <div className={styles['auth__card']} onClick={(e) => e.stopPropagation()}>
        <button 
          className={styles['auth__close']} 
          onClick={onClose} 
          aria-label="Close modal"
        >
          <X className={styles['close-icon'] || 'close-icon'} strokeWidth={2} size={20} />
        </button>
        
          {mode === 'login' ? (
            <>
              <h2 className={styles['auth__title']}>Welcome back</h2>
              <p className={styles['auth__sub']}>
                Sign in to sync your library and reading progress.
              </p>
              <LoginForm 
                onSwitch={() => setMode('register')} 
                onSuccess={onClose} 
              />
            </>
          ) : (
            <>
              <h2 className={styles['auth__title']}>Create your account</h2>
              <p className={styles['auth__sub']}>
                Sign up to follow series, save reading progress, and join the discussion.
              </p>
              <RegisterForm 
                onSwitch={() => setMode('login')} 
                onSuccess={() => setMode('login')} 
              />
            </>
          )}
        </div>
      </div>
  );

  // Render modal vào document.body để tránh xung đột layout CSS
  return createPortal(modalContent, document.body);
}