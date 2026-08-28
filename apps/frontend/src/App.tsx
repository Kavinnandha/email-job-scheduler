import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { ComposePage } from '@/pages/Compose';
import { EmailDetailPage } from '@/pages/EmailDetail';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" className="text-brand-500" />
    </div>
  );
}

/** Sends unauthenticated visitors to the login page, preserving nothing else. */
function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/compose"
        element={
          <Protected>
            <ComposePage />
          </Protected>
        }
      />
      <Route
        path="/email/:id"
        element={
          <Protected>
            <EmailDetailPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
