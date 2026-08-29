import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { ComposePage } from '@/pages/Compose';
import { EmailDetailPage } from '@/pages/EmailDetail';
function FullPageSpinner() {
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center", children: _jsx(Spinner, { size: "lg", className: "text-brand-500" }) }));
}
/** Sends unauthenticated visitors to the login page, preserving nothing else. */
function Protected({ children }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? _jsx(_Fragment, { children: children }) : _jsx(Navigate, { to: "/login", replace: true });
}
export function App() {
    const { isAuthenticated, isLoading } = useAuth();
    // Waiting for /api/auth/me before routing avoids a flash of the login page
    // for a user who already has a valid session.
    if (isLoading)
        return _jsx(FullPageSpinner, {});
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: isAuthenticated ? _jsx(Navigate, { to: "/", replace: true }) : _jsx(LoginPage, {}) }), _jsx(Route, { path: "/", element: _jsx(Protected, { children: _jsx(DashboardPage, {}) }) }), _jsx(Route, { path: "/compose", element: _jsx(Protected, { children: _jsx(ComposePage, {}) }) }), _jsx(Route, { path: "/email/:id", element: _jsx(Protected, { children: _jsx(EmailDetailPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
