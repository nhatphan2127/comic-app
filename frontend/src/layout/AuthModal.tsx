import { useState } from 'react';
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

  if (!isOpen) return null;

  return (
    // Click vào backdrop sẽ tự đóng modal
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">
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
              <p className="muted">Sign up to follow series, save reading progress, and join the discussion.</p>
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
}