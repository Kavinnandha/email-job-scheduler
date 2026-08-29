import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
import { cn } from '@/lib/cn';
const FIELD_STYLES = 'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-900 ' +
    'placeholder:text-slate-400 transition-colors ' +
    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ' +
    'disabled:cursor-not-allowed disabled:bg-slate-50';
function FieldWrapper({ label, hint, error, htmlFor, children }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [label && (_jsx("label", { htmlFor: htmlFor, className: "block text-sm font-medium text-slate-700", children: label })), children, error ? (_jsx("p", { className: "text-xs text-red-600", children: error })) : hint ? (_jsx("p", { className: "text-xs text-slate-500", children: hint })) : null] }));
}
export function Input({ label, hint, error, className, id, ...rest }) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (_jsx(FieldWrapper, { label: label, hint: hint, error: error, htmlFor: inputId, children: _jsx("input", { id: inputId, "aria-invalid": error ? true : undefined, className: cn(FIELD_STYLES, error && 'border-red-400 focus:border-red-500', className), ...rest }) }));
}
export function Textarea({ label, hint, error, className, id, ...rest }) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (_jsx(FieldWrapper, { label: label, hint: hint, error: error, htmlFor: inputId, children: _jsx("textarea", { id: inputId, "aria-invalid": error ? true : undefined, className: cn(FIELD_STYLES, 'resize-y', error && 'border-red-400', className), ...rest }) }));
}
