import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { ChevronDownIcon, ClockIcon, SendIcon } from '@/components/icons';
import { UserMenu } from './UserMenu';
/**
 * Blocky "ONB" wordmark from the design, drawn as a 5x7 bitmap per glyph rather
 * than shipped as an asset so it stays crisp at any zoom and inherits the ink
 * colour.
 */
const WORDMARK_GLYPHS = [
    // '#' is a filled cell, '.' is empty.
    ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
    ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
];
function Wordmark() {
    return (_jsx("div", { className: "flex items-center gap-[4px]", "aria-label": "ONB", role: "img", children: WORDMARK_GLYPHS.map((glyph, gi) => (_jsx("div", { className: "grid grid-cols-5 gap-px", children: glyph.flatMap((row, ri) => [...row].map((cell, ci) => (_jsx("span", { className: cn('h-[5px] w-[5px]', cell === '#' ? 'bg-ink' : 'bg-transparent') }, `${ri}-${ci}`)))) }, gi))) }));
}
function NavItem({ label, count, active, icon, onClick }) {
    return (_jsxs("button", { onClick: onClick, "aria-current": active ? 'page' : undefined, className: cn('flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition-colors', active ? 'bg-brand-50 font-semibold text-ink' : 'text-ink-muted hover:bg-field'), children: [_jsx("span", { className: active ? 'text-ink' : 'text-ink-muted', children: icon }), _jsx("span", { className: "flex-1 text-left", children: label }), count !== undefined && (_jsx("span", { className: cn('text-sm', active ? 'text-ink' : 'text-ink-faint'), children: count }))] }));
}
export function Sidebar({ user, counts, activeStatus, onSelectStatus }) {
    const navigate = useNavigate();
    return (_jsxs("aside", { className: "flex w-[280px] shrink-0 flex-col border-r border-line bg-white px-4 py-5", children: [_jsx("div", { className: "mb-6 pl-2", children: _jsx(Wordmark, {}) }), _jsx(UserMenu, { user: user, children: _jsxs("div", { className: "flex w-full items-center gap-3 rounded-2xl bg-field px-3 py-2.5 text-left transition-colors hover:bg-line", children: [_jsx(Avatar, { user: user }), _jsxs("div", { className: "min-w-0 flex-1 leading-tight", children: [_jsx("p", { className: "truncate text-[15px] font-semibold text-ink", children: user.name }), _jsx("p", { className: "truncate text-[13px] text-ink-muted", children: user.email })] }), _jsx(ChevronDownIcon, { className: "h-4 w-4 shrink-0 text-ink-muted" })] }) }), _jsx("button", { onClick: () => navigate('/compose'), className: "mt-4 h-[46px] w-full rounded-full border border-brand-500 text-[15px] font-medium text-brand-500 transition-colors hover:bg-brand-50", children: "Compose" }), _jsx("p", { className: "mb-2 mt-7 px-4 text-[12px] font-medium uppercase tracking-wider text-ink-faint", children: "Core" }), _jsxs("nav", { className: "space-y-1", children: [_jsx(NavItem, { label: "Scheduled", count: counts.SCHEDULED, active: activeStatus === 'SCHEDULED', icon: _jsx(ClockIcon, { className: "h-[18px] w-[18px]" }), onClick: () => onSelectStatus('SCHEDULED') }), _jsx(NavItem, { label: "Sent", count: counts.SENT, active: activeStatus === 'SENT', icon: _jsx(SendIcon, { className: "h-[18px] w-[18px]" }), onClick: () => onSelectStatus('SENT') })] })] }));
}
export function Avatar({ user, size = 40 }) {
    if (user.avatarUrl) {
        return (_jsx("img", { src: user.avatarUrl, alt: "", width: size, height: size, 
            // Google's CDN returns 403 for profile images requested with a
            // referrer from another origin.
            referrerPolicy: "no-referrer", className: "shrink-0 rounded-full object-cover", style: { width: size, height: size } }));
    }
    return (_jsx("div", { className: "flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-white", style: { width: size, height: size, fontSize: size * 0.4 }, children: user.name.charAt(0).toUpperCase() }));
}
// Re-exported so NavLink stays available to callers that route by URL.
export { NavLink };
