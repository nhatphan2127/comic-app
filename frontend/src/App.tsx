import { useEffect } from 'react';
import Home from './pages/Home';
import { useTheme } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext';
import { Routes, Route, BrowserRouter } from "react-router-dom";
import './App.css'
import MangaDetails from './pages/MangaDetail';
import MangaReader from './pages/MangaReader';
import UserProfile from './pages/UserProfile'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';

function App() {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>

      <AuthProvider>
          <Routes>

            <Route path="/" element={<Home />} />
            <Route path="comics/:comicUrl" element={<MangaDetails />} />
            <Route path="comics/:comicUrl/:chapterId" element={<MangaReader />} />

            {/* 2. Thêm Route cho trang cá nhân tại đây */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } 
            />

            {/* <Route path="*" element={<NotFound />} /> */}

          </Routes>
      </AuthProvider>

    </BrowserRouter>

  )
}

export default App
