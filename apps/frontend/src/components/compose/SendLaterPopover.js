import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon } from '@/components/icons';
import { toDateTimeLocalValue } from '@/lib/datetime';
import { cn } from '@/lib/cn';
function buildPresets(now) {
    const atTomorrow = (hours, minutes = 0) => {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(hours, minutes, 0, 0);
        return d;
    };
    return [
        // Bare "Tomorrow" keeps the current time of day, which is what the phrase
        // means when no clock time is given.
        { label: 'Tomorrow', date: atTomorrow(now.getHours(), now.getMinutes()) },
        { label: 'Tomorrow, 10:00 AM', date: atTomorrow(10) },
        { label: 'Tomorrow, 11:00 AM', date: atTomorrow(11) },
        { label: 'Tomorrow, 3:00 PM', date: atTomorrow(15) },
    ];
}
export function SendLaterPopover({ value, onApply, onClose }) {
    const containerRef = useRef(null);
    const [draft, setDraft] = useState(value ? toDateTimeLocalValue(value) : '');
    const [focused, setFocused] = useState(false);
    // An empty datetime-local still paints its own "dd-mm-yyyy --:--" mask, which
    // collided with the design's placeholder. Hide the mask until the field is
    // focused or filled, and show the placeholder only in that same window.
    const showNativeMask = Boolean(draft) || focused;
    // Presets are derived once per mount so they cannot shift under the user
    // while the popover is open.
    const presets = useMemo(() => buildPresets(new Date()), []);
    useEffect(() => {
        const onPointerDown = (event) => {
            if (!containerRef.current?.contains(event.target))
                onClose();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);
    const apply = () => {
        if (!draft) {
            onApply(null);
            onClose();
            return;
        }
        const parsed = new Date(draft);
        onApply(Number.isNaN(parsed.getTime()) ? null : parsed);
        onClose();
    };
    return (_jsxs("div", { ref: containerRef, role: "dialog", "aria-label": "Send Later", className: "absolute right-0 top-full z-40 mt-3 w-[400px] rounded-2xl bg-white p-6 shadow-pop ring-1 ring-line", children: [_jsx("h2", { className: "text-[19px] font-semibold text-ink", children: "Send Later" }), _jsxs("div", { className: "relative mt-5 border-b border-line pb-2", children: [_jsx("input", { type: "datetime-local", value: draft, 
                        // datetime-local has no timezone, so the value is read as local time -
                        // the same clock the user is picking against.
                        onChange: (e) => setDraft(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), 
                        // Prevents choosing a moment that has already passed.
                        min: toDateTimeLocalValue(new Date()), "aria-label": "Pick date and time", className: cn('block h-6 w-full bg-transparent pr-8 text-[15px] leading-6 focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-0', showNativeMask ? 'text-ink' : 'text-transparent') }), !showNativeMask && (_jsx("span", { className: "pointer-events-none absolute left-0 top-0 text-[15px] leading-6 text-ink-muted", children: "Pick date & time" })), _jsx(CalendarIcon, { className: "pointer-events-none absolute right-0 top-0.5 h-5 w-5 text-ink-muted" })] }), _jsx("ul", { className: "mt-5 space-y-4", children: presets.map((preset) => (_jsx("li", { children: _jsx("button", { type: "button", onClick: () => setDraft(toDateTimeLocalValue(preset.date)), className: "w-full text-left text-[15px] text-ink transition-colors hover:text-brand-600", children: preset.label }) }, preset.label))) }), _jsxs("div", { className: "mt-8 flex items-center justify-end gap-4", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-2 text-[15px] text-ink transition-colors hover:text-ink-muted", children: "Cancel" }), _jsx("button", { type: "button", onClick: apply, className: "h-10 rounded-full border border-brand-500 px-8 text-[15px] font-medium text-brand-500 transition-colors hover:bg-brand-50", children: "Done" })] })] }));
}
