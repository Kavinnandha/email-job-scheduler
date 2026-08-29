import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';
const VARIANTS = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:hover:bg-brand-500',
    secondary: 'bg-white text-slate-700 border border-surface-border hover:bg-slate-50 disabled:hover:bg-white',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600',
};
const SIZES = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
};
export function Button({ variant = 'primary', size = 'md', loading = false, leftIcon, className, children, disabled, ...rest }) {
    return (_jsxs("button", { 
        // Disabled while loading so a double click cannot fire the action twice.
        disabled: disabled || loading, className: cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors', 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2', 'disabled:cursor-not-allowed disabled:opacity-60', VARIANTS[variant], SIZES[size], className), ...rest, children: [loading ? _jsx(Spinner, { size: "sm" }) : leftIcon, children] }));
}
