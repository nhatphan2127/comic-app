import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import ConsoleLayout from './ConsoleLayout';
import type { ConsoleConfig } from './types';

/** Mounts a console at `config.basePath/*`: access check, shell, and one route per module the user may see. */
export default function ConsoleApp({ config }: { config: ConsoleConfig }) {
  const { user } = useAuth();
  const modules = config.modules.filter((m) => !m.access || m.access(user?.role));

  return (
    <ProtectedRoute allow={config.access}>
      <Routes>
        <Route element={<ConsoleLayout config={config} modules={modules} />}>
          {modules.map(({ path, element: Element }) =>
            path ? (
              <Route key={path} path={`${path}/*`} element={<Element />} />
            ) : (
              <Route key="index" index element={<Element />} />
            ),
          )}
          <Route path="*" element={<Navigate to={config.basePath} replace />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  );
}
