import { useEffect, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import LoginForm from '../../components/LoginForm/LoginForm';
import RegisterForm from '../../components/RegisterForm/RegisterForm';
import ForgotPasswordForm from '../../components/ForgotPasswordForm/ForgotPasswordForm';

export type AuthMode = 'login' | 'register' | 'forgot';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to sync your library and reading progress.',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Follow series, save your progress and join the discussion.',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'Enter the email of your account and we will send you a link.',
  },
};

export default function AuthModalLayout({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');

  // Always reopen on the login screen.
  useEffect(() => {
    if (!isOpen) setMode('login');
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={COPY[mode].title} subtitle={COPY[mode].subtitle}>
      {mode === 'login' ? (
        <LoginForm onSwitch={() => setMode('register')} onForgot={() => setMode('forgot')} onSuccess={onClose} />
      ) : mode === 'register' ? (
        // Registering also signs in, so the modal just closes.
        <RegisterForm onSwitch={() => setMode('login')} onSuccess={onClose} />
      ) : (
        <ForgotPasswordForm onBack={() => setMode('login')} />
      )}
    </Modal>
  );
}
