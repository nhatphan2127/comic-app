import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Role check (see helpers/roles). Without it, any logged-in user may enter. */
  allow?: (role?: string | null) => boolean;
  /** Where a logged-in user without the role is sent. */
  fallback?: string;
}

export default function ProtectedRoute({ children, allow, fallback = '/profile' }: ProtectedRouteProps) {
  const { isLoggedIn, user, roleChecked } = useAuth();

  if (!isLoggedIn) return <Navigate to="/" replace />;

  if (allow && !allow(user?.role)) {
    // The stored role may be stale (just promoted): wait for the server's answer before turning them away.
    if (!roleChecked) return <div className="empty-state">Checking access…</div>;
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
