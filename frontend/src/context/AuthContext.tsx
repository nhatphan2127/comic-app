// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface User {
  id: string;
  userName: string;
  displayName?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  /** Merges fresh fields (e.g. a role changed by an admin) into the stored user. */
  updateUser: (fields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Thay đổi URL này cho phù hợp với cổng chạy Backend của bạn (ví dụ: http://localhost:5000)
export const API_BASE_URL = 'http://localhost:5000/api/v1/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read synchronously so the first render already knows who is logged in;
  // otherwise ProtectedRoute redirects away on every reload of a protected page.
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
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

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    // No page reload: components that show per-user data re-fetch when `token` changes.
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // The API answered 401 to a request that carried our token: the session ended on the server
  // (expired, logged out elsewhere, password reset), so stop pretending to be logged in.
  useEffect(() => {
    window.addEventListener('auth-expired', clearSession);
    return () => window.removeEventListener('auth-expired', clearSession);
  }, [clearSession]);

  const logout = async () => {
    try {
      if (token) {
        // Gọi API logout để xóa session trên DB
        await fetch(`${API_BASE_URL}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Không thể gọi API logout ở server:', error);
    } finally {
      clearSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn: !!token, login, logout, updateUser }}>
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