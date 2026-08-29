import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
/** Floating dark pill from the design, centred over the list. */
export function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1)
        return null;
    return (_jsx("div", { className: "pointer-events-none absolute inset-x-0 bottom-6 flex justify-center", children: _jsxs("div", { className: "pointer-events-auto flex items-center gap-1 rounded-xl bg-[#1f2329] px-2 py-1.5 text-white shadow-pop", children: [_jsx("button", { onClick: () => onChange(page - 1), disabled: page <= 1, "aria-label": "Previous page", className: "rounded-lg p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent", children: _jsx(ChevronLeftIcon, { className: "h-4 w-4" }) }), _jsxs("span", { className: "min-w-[52px] text-center text-sm font-semibold tabular-nums", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => onChange(page + 1), disabled: page >= totalPages, "aria-label": "Next page", className: "rounded-lg p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent", children: _jsx(ChevronRightIcon, { className: "h-4 w-4" }) })] }) }));
}
