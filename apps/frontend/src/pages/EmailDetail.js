import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon, StarIcon, TrashIcon } from '@/components/icons';
import { Avatar } from '@/components/layout/Sidebar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useCancelEmail, useEmail, useToggleStar } from '@/hooks/useEmails';
import { formatDetailTime, formatRowTime } from '@/lib/datetime';
import { cn } from '@/lib/cn';
export function EmailDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notify } = useToast();
    const email = useEmail(id);
    const toggleStar = useToggleStar();
    const cancelEmail = useCancelEmail();
    if (email.isLoading) {
        return (_jsx("div", { className: "flex h-screen items-center justify-center", children: _jsx(Spinner, { size: "lg", className: "text-brand-500" }) }));
    }
    if (email.error || !email.data) {
        return (_jsx("div", { className: "flex h-screen flex-col items-center justify-center", children: _jsx(EmptyState, { tone: "error", title: "Email not found", description: "It may have been cancelled or never existed.", action: _jsx("button", { onClick: () => navigate('/'), className: "rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-field", children: "Back to inbox" }) }) }));
    }
    const record = email.data;
    const isScheduled = record.status === 'SCHEDULED';
    // Return to the tab this email belongs to rather than the dashboard default,
    // which would silently switch a sent email's reader over to Scheduled.
    const listHref = record.status === 'SENT' ? '/?tab=sent' : '/';
    const handleCancel = () => {
        cancelEmail.mutate(record.id, {
            onSuccess: () => {
                notify('Scheduled email cancelled', 'success');
                navigate('/');
            },
            onError: (err) => notify(err instanceof Error ? err.message : 'Could not cancel', 'error'),
        });
    };
    return (_jsxs("div", { className: "flex h-screen flex-col overflow-hidden bg-white", children: [_jsxs("header", { className: "flex items-center gap-4 border-b border-line px-6 py-4", children: [_jsx("button", { onClick: () => navigate(listHref), "aria-label": "Back", className: "rounded-lg p-1 text-ink transition-colors hover:bg-field", children: _jsx(ArrowLeftIcon, { className: "h-6 w-6" }) }), _jsx("h1", { className: "min-w-0 flex-1 truncate text-[22px] font-medium text-ink", children: record.subject }), _jsx("button", { onClick: () => toggleStar.mutate({ id: record.id, starred: !record.starred }, { onError: () => notify('Could not update star', 'error') }), "aria-label": record.starred ? 'Unstar' : 'Star', className: cn('rounded-lg p-2 transition-colors hover:bg-field', record.starred ? 'text-amber-400' : 'text-ink-faint'), children: _jsx(StarIcon, { filled: record.starred, className: "h-[22px] w-[22px]" }) }), isScheduled && (_jsx("button", { onClick: handleCancel, disabled: cancelEmail.isPending, "aria-label": "Cancel scheduled email", title: "Cancel scheduled email", className: "rounded-lg p-2 text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50", children: _jsx(TrashIcon, { className: "h-[22px] w-[22px]" }) })), _jsx("span", { className: "mx-1 h-6 w-px bg-line" }), user && _jsx(Avatar, { user: user, size: 36 })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsxs("div", { className: "mx-auto max-w-4xl px-8 py-8", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg font-semibold text-white", children: (record.senderDisplayName || '?').charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-baseline gap-2", children: [_jsx("span", { className: "text-[16px] font-bold text-ink", children: record.senderDisplayName }), _jsxs("span", { className: "text-sm text-ink-muted", children: ["<", record.senderEmail, ">"] }), _jsx("span", { className: "ml-auto whitespace-nowrap text-sm text-ink-muted", children: record.status === 'SENT'
                                                        ? formatDetailTime(record.sentAt)
                                                        : formatDetailTime(record.scheduledAt) })] }), _jsxs("p", { className: "mt-0.5 text-sm text-ink-muted", children: ["to ", record.recipient] })] })] }), isScheduled && (_jsxs("div", { className: "mt-6 flex items-center gap-2 rounded-lg bg-chip-warn px-4 py-2.5 text-sm text-chip-warnText", children: [_jsx(ClockIcon, { className: "h-4 w-4" }), "Scheduled to send ", formatRowTime(record.scheduledAt)] })), record.status === 'FAILED' && record.error && (_jsxs("div", { className: "mt-6 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700", children: ["Delivery failed after ", record.attempts, " attempt", record.attempts === 1 ? '' : 's', ": ", record.error] })), _jsx("div", { className: "prose-email mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-ink", children: record.body }), record.previewUrl && (_jsx("a", { href: record.previewUrl, target: "_blank", rel: "noreferrer", className: "mt-8 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50", children: "View delivered message on Ethereal" }))] }) })] }));
}
