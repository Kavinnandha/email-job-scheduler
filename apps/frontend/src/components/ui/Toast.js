import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
const ToastContext = createContext(null);
const TONES = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-slate-800',
};
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const notify = useCallback((message, tone = 'info') => {
        // Date.now() alone can collide when two toasts fire in the same tick.
        const id = Date.now() + Math.random();
        setToasts((current) => [...current, { id, message, tone }]);
        setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4500);
    }, []);
    const value = useMemo(() => ({ notify }), [notify]);
    return (_jsxs(ToastContext.Provider, { value: value, children: [children, _jsx("div", { className: "pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2", children: toasts.map((toast) => (_jsx("div", { role: "status", className: cn('pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg', TONES[toast.tone]), children: toast.message }, toast.id))) })] }));
}
export function useToast() {
    const context = useContext(ToastContext);
    if (!context)
        throw new Error('useToast must be used within a ToastProvider');
    return context;
}
