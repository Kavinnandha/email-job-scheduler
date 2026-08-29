import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
import { ClockIcon, StarIcon } from '@/components/icons';
import { formatRowTime } from '@/lib/datetime';
/** Orange clock pill for scheduled, neutral pill for a settled email. */
function StatusChip({ email }) {
    if (email.status === 'SCHEDULED') {
        return (_jsxs("span", { className: "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chip-warn px-3 py-1 text-[13px] font-medium text-chip-warnText", children: [_jsx(ClockIcon, { className: "h-[13px] w-[13px]" }), formatRowTime(email.scheduledAt)] }));
    }
    if (email.status === 'FAILED') {
        return (_jsx("span", { className: "inline-flex shrink-0 items-center rounded-full bg-red-50 px-3 py-1 text-[13px] font-medium text-red-700", children: "Failed" }));
    }
    return (_jsx("span", { className: "inline-flex shrink-0 items-center rounded-full bg-chip-idle px-3 py-1 text-[13px] font-medium text-chip-idleText", children: "Sent" }));
}
export function EmailRow({ email, onOpen, onToggleStar }) {
    return (_jsxs("div", { role: "button", tabIndex: 0, onClick: () => onOpen(email), onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(email);
            }
        }, className: "flex cursor-pointer items-center gap-5 border-b border-line px-6 py-4 transition-colors hover:bg-field/60", children: [_jsxs("span", { className: "w-[150px] shrink-0 truncate text-[15px] font-semibold text-ink", children: ["To: ", email.recipient] }), _jsx(StatusChip, { email: email }), _jsxs("div", { className: "min-w-0 flex-1 truncate text-[15px]", children: [_jsx("span", { className: "font-semibold text-ink", children: email.subject }), email.error ? (_jsxs("span", { className: "text-ink-faint", children: [" - ", email.error] })) : (_jsxs("span", { className: "text-ink-faint", children: [" - ", email.senderName ?? 'Scheduled send'] }))] }), _jsx("button", { onClick: (e) => {
                    // The row is clickable; without this the star would also open it.
                    e.stopPropagation();
                    onToggleStar(email);
                }, "aria-label": email.starred ? 'Unstar' : 'Star', "aria-pressed": email.starred, className: cn('shrink-0 rounded p-1 transition-colors', email.starred ? 'text-amber-400' : 'text-line hover:text-ink-faint'), children: _jsx(StarIcon, { filled: email.starred, className: "h-[21px] w-[21px]" }) })] }));
}
