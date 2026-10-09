import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import PreferenceSync from './components/PreferenceSync/PreferenceSync';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import Home from './pages/Home';

// Secondary routes are split into their own chunks.
const Browse = lazy(() => import('./pages/Browse'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const MangaDetail = lazy(() => import('./pages/MangaDetail'));
const MangaReader = lazy(() => import('./pages/MangaReader'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
// Separate workspaces with their own shell (see src/console and src/features).
const Studio = lazy(() => import('./pages/Studio'));
const Admin = lazy(() => import('./pages/Admin'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PreferenceSync />
          <Suspense fallback={<div className="empty-state">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="browse" element={<Browse />} />
              <Route path="users/:userId" element={<PublicProfile />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="comics/:comicUrl" element={<MangaDetail />} />
              <Route path="comics/:comicUrl/:chapterId" element={<MangaReader />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />
              <Route path="studio/*" element={<Studio />} />
              <Route path="admin/*" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
