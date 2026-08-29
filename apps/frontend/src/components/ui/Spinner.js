import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
const SIZES = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-[3px]',
};
export function Spinner({ size = 'md', className, label = 'Loading' }) {
    return (_jsx("span", { role: "status", "aria-label": label, className: cn('inline-block animate-spin rounded-full border-current border-t-transparent', SIZES[size], className) }));
}
