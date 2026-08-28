import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" className="text-brand-500" />
    </div>
  );
}

export function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // Waiting for /api/auth/me before routing avoids a flash of the login page
  // for a user who already has a valid session.
  if (isLoading) return <FullPageSpinner />;

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
