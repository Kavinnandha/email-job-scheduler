import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useLogout } from '@/hooks/useAuth';
import { SlackConnectButton } from '@/components/SlackConnectButton';
/**
 * The user card in the design carries a chevron, so it opens something. This
 * is where Slack connect and logout live - both belong to the account rather
 * than to the mail list, and the header in this layout has no room for them.
 */
export function UserMenu({ user, children }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const logout = useLogout();
    useEffect(() => {
        if (!open)
            return;
        const onPointerDown = (event) => {
            if (!containerRef.current?.contains(event.target))
                setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);
    return (_jsxs("div", { ref: containerRef, className: "relative", children: [_jsx("button", { type: "button", onClick: () => setOpen((v) => !v), "aria-expanded": open, "aria-haspopup": "menu", className: "w-full", children: children }), open && (_jsxs("div", { role: "menu", className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-line bg-white p-3 shadow-pop", children: [_jsxs("div", { className: "border-b border-line pb-3", children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: user.name }), _jsx("p", { className: "truncate text-xs text-ink-muted", children: user.email })] }), _jsx("div", { className: "flex flex-col gap-2 py-3", children: _jsx(SlackConnectButton, {}) }), _jsx("button", { onClick: () => logout.mutate(undefined, {
                            // Full reload rather than client navigation, so no cached
                            // component state survives the session change.
                            onSuccess: () => window.location.assign('/login'),
                        }), disabled: logout.isPending, className: "w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-field disabled:opacity-60", children: logout.isPending ? 'Logging out…' : 'Log out' })] }))] }));
}
