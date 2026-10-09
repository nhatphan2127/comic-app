// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, userApi } from '../services/api';

export interface User {
  id: string;
  userName: string;
  displayName?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  /** Merges fresh fields (e.g. a role changed by an admin) into the stored user. */
  updateUser: (fields: Partial<User>) => void;
  /** True once the stored role was checked against the server in this tab (role-gated pages wait for it). */
  roleChecked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // The session token is in an HttpOnly cookie that scripts cannot read. Only the (non-secret) user
  // is kept here, read synchronously so the first render already knows who is logged in; otherwise
  // ProtectedRoute redirects away on every reload of a protected page. The server stays the judge:
  // a 401 from it clears this copy (see 'auth-expired' below).
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });

  const updateUser = useCallback((fields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...fields };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  // Tokens stored by older versions of the app are useless now; don't leave them lying around.
  useEffect(() => localStorage.removeItem('token'), []);

  const login = (newUser: User) => {
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
    // No page reload: components that show per-user data re-fetch when `user.id` changes.
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const userId = user?.id ?? null;

  // The stored role can be stale (an admin promoted or demoted us), so re-read it from the server
  // after login, on load and whenever the tab regains focus.
  const [roleChecked, setRoleChecked] = useState(false);
  useEffect(() => {
    if (!userId) {
      setRoleChecked(false);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      userApi
        .getProfile()
        .then((me) => {
          if (!cancelled && me) updateUser({ role: me.role ?? undefined, displayName: me.displayName ?? undefined });
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setRoleChecked(true));
    const onVisible = () => document.visibilityState === 'visible' && refresh();

    refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, updateUser]);

  // The API answered 401 to an authenticated request: the session ended on the server
  // (expired, logged out elsewhere, password reset), so stop pretending to be logged in.
  useEffect(() => {
    window.addEventListener('auth-expired', clearSession);
    return () => window.removeEventListener('auth-expired', clearSession);
  }, [clearSession]);

  const logout = async () => {
    try {
      // Xóa session trên DB và xóa cookie (JS không tự xóa được cookie HttpOnly)
      await authApi.logout();
    } catch (error) {
      console.error('Không thể gọi API logout ở server:', error);
    } finally {
      clearSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, updateUser, roleChecked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth phải được bọc trong AuthProvider');
  }
  return context;
}