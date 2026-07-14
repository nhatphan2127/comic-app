import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import '../assets/styles/AuthModal.css';

import { X } from 'lucide-react';

export type AuthMode = 'login' | 'register';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
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
      className="auth-modal-backdrop" 
      role="dialog" 
      aria-modal="true" 
      onClick={onClose}
    >
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button 
          className="auth-close" 
          onClick={onClose} 
          aria-label="Close modal"
        >
          <X className="close-icon" strokeWidth={2} size={20} />
        </button>
        
        <div className="auth-content">
          {mode === 'login' ? (
            <>
              <h2>Welcome back</h2>
              <p className="muted">Sign in to sync your library and reading progress.</p>
              <LoginForm 
                onSwitch={() => setMode('register')} 
                onSuccess={onClose} 
              />
            </>
          ) : (
            <>
              <h2>Create your account</h2>
              <p className="muted">
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
    </div>
  );

  // Render modal vào document.body để tránh xung đột layout CSS
  return createPortal(modalContent, document.body);
}