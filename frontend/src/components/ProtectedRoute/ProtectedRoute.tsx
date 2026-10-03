import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoggedIn, token } = useAuth();

  // Kiểm tra cả isLoggedIn và token để chắc chắn
  if (!isLoggedIn || !token) {
    // Nếu chưa đăng nhập, chuyển hướng về trang chủ
    // Bạn có thể tùy chỉnh để mở modal đăng nhập ở đây nếu trang chủ có logic đó
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
