import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { FilterIcon, RefreshIcon, SearchIcon } from '@/components/icons';
export function TopBar({ search, onSearchChange, filters, onFiltersChange, senders, onRefresh, refreshing, }) {
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef(null);
    useEffect(() => {
        if (!filterOpen)
            return;
        const onPointerDown = (event) => {
            if (!filterRef.current?.contains(event.target))
                setFilterOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [filterOpen]);
    const filterCount = (filters.senderId ? 1 : 0) + (filters.starredOnly ? 1 : 0);
    return (_jsxs("div", { className: "flex items-center gap-3 border-b border-line bg-white px-6 py-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(SearchIcon, { className: "pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" }), _jsx("input", { type: "search", value: search, onChange: (e) => onSearchChange(e.target.value), placeholder: "Search", "aria-label": "Search emails", className: "h-11 w-full rounded-full bg-field pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-100" })] }), _jsxs("div", { ref: filterRef, className: "relative", children: [_jsxs("button", { onClick: () => setFilterOpen((v) => !v), "aria-label": "Filter", "aria-expanded": filterOpen, className: cn('relative rounded-lg p-2 transition-colors hover:bg-field', filterCount > 0 ? 'text-brand-500' : 'text-ink-muted'), children: [_jsx(FilterIcon, { className: "h-[19px] w-[19px]" }), filterCount > 0 && (_jsx("span", { className: "absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white", children: filterCount }))] }), filterOpen && (_jsxs("div", { className: "absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-pop", children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint", children: "Sender" }), _jsxs("select", { value: filters.senderId ?? '', onChange: (e) => onFiltersChange({ ...filters, senderId: e.target.value || null }), className: "mb-3 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-100", children: [_jsx("option", { value: "", children: "All senders" }), senders.map((sender) => (_jsx("option", { value: sender.id, children: sender.name }, sender.id)))] }), _jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-sm text-ink", children: [_jsx("input", { type: "checkbox", checked: filters.starredOnly, onChange: (e) => onFiltersChange({ ...filters, starredOnly: e.target.checked }), className: "h-4 w-4 accent-brand-500" }), "Starred only"] })] }))] }), _jsx("button", { onClick: onRefresh, "aria-label": "Refresh", className: "rounded-lg p-2 text-ink-muted transition-colors hover:bg-field", children: _jsx(RefreshIcon, { className: cn('h-[19px] w-[19px]', refreshing && 'animate-spin') }) })] }));
}
