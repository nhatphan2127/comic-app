import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  // </StrictMode>,
)

// Offline support and "install app". Only in production builds: in development a service worker
// would serve stale files while editing.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
  });
}
