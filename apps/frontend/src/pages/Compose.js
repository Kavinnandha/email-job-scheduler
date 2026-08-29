import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '@/api/client';
import { ArrowLeftIcon, ClockIcon, PaperclipIcon } from '@/components/icons';
import { RecipientInput } from '@/components/compose/RecipientInput';
import { RichTextEditor } from '@/components/compose/RichTextEditor';
import { SendLaterPopover } from '@/components/compose/SendLaterPopover';
import { useToast } from '@/components/ui/Toast';
import { useCreateCampaign, useSenders } from '@/hooks/useEmails';
import { htmlToPlainText } from '@/lib/html';
import { cn } from '@/lib/cn';
export function ComposePage() {
    const navigate = useNavigate();
    const { notify } = useToast();
    const senders = useSenders();
    const createCampaign = useCreateCampaign();
    const [senderId, setSenderId] = useState('');
    const [recipients, setRecipients] = useState([]);
    const [subject, setSubject] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [delaySeconds, setDelaySeconds] = useState('');
    const [hourlyLimit, setHourlyLimit] = useState('');
    const [sendAt, setSendAt] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [sendLaterOpen, setSendLaterOpen] = useState(false);
    const [errors, setErrors] = useState({});
    const attachmentRef = useRef(null);
    const activeSender = useMemo(() => senders.data?.find((s) => s.id === senderId) ?? senders.data?.[0], [senders.data, senderId]);
    const handleAttach = (event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0)
            return;
        setAttachments((current) => [...current, ...files]);
        notify(`${files.length} file${files.length === 1 ? '' : 's'} attached. Attachments are staged in the browser only — this scheduler sends the message body.`, 'info');
        event.target.value = '';
    };
    const validate = () => {
        const next = {};
        const plain = htmlToPlainText(bodyHtml).trim();
        if (recipients.length === 0)
            next.recipients = 'Add at least one recipient';
        if (!subject.trim())
            next.subject = 'Subject is required';
        if (!plain)
            next.body = 'Message body is required';
        if (delaySeconds && Number(delaySeconds) < 0)
            next.delay = 'Must be 0 or more';
        if (hourlyLimit && Number(hourlyLimit) < 1)
            next.limit = 'Must be at least 1';
        setErrors(next);
        return Object.keys(next).length === 0;
    };
    const submit = () => {
        if (!validate())
            return;
        const payload = {
            subject: subject.trim(),
            // The scheduler sends plain-text mail, so the editor's markup is
            // flattened here rather than shipping tags into the message body.
            body: htmlToPlainText(bodyHtml),
            recipients,
            // No explicit time means "start now"; the backend clamps a past time up
            // to the present rather than firing everything with a negative delay.
            startTime: (sendAt ?? new Date()).toISOString(),
            delaySeconds: delaySeconds ? Number(delaySeconds) : 0,
            ...(hourlyLimit ? { hourlyLimit: Number(hourlyLimit) } : {}),
            ...(activeSender ? { senderIds: [activeSender.id] } : {}),
        };
        createCampaign.mutate(payload, {
            onSuccess: (result) => {
                const skipped = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
                notify(`Scheduled ${result.scheduled} email${result.scheduled === 1 ? '' : 's'}${skipped}`, 'success');
                navigate('/');
            },
            onError: (error) => notify(errorMessage(error), 'error'),
        });
    };
    const sendLabel = sendAt ? 'Send Later' : 'Send';
    return (_jsxs("div", { className: "flex h-screen flex-col overflow-hidden bg-white", children: [_jsxs("header", { className: "flex items-center gap-4 px-6 py-4", children: [_jsx("button", { onClick: () => navigate('/'), "aria-label": "Back", className: "rounded-lg p-1 text-ink transition-colors hover:bg-field", children: _jsx(ArrowLeftIcon, { className: "h-6 w-6" }) }), _jsx("h1", { className: "flex-1 text-[22px] font-medium text-ink", children: "Compose New Email" }), _jsxs("button", { type: "button", onClick: () => attachmentRef.current?.click(), "aria-label": "Attach files", className: "relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-field", children: [_jsx(PaperclipIcon, { className: "h-[21px] w-[21px]" }), attachments.length > 0 && (_jsx("span", { className: "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white", children: attachments.length }))] }), _jsx("input", { ref: attachmentRef, type: "file", multiple: true, onChange: handleAttach, className: "sr-only" }), _jsxs("div", { className: "relative", children: [_jsx("button", { type: "button", onClick: () => setSendLaterOpen((v) => !v), "aria-label": "Schedule send", "aria-expanded": sendLaterOpen, className: cn('rounded-lg p-2 transition-colors hover:bg-field', sendAt ? 'text-brand-500' : 'text-ink-muted'), children: _jsx(ClockIcon, { className: "h-[21px] w-[21px]" }) }), sendLaterOpen && (_jsx(SendLaterPopover, { value: sendAt, onApply: setSendAt, onClose: () => setSendLaterOpen(false) }))] }), _jsx("button", { type: "button", onClick: submit, disabled: createCampaign.isPending, className: "h-11 rounded-full border border-brand-500 px-8 text-[15px] font-medium text-brand-500 transition-colors hover:bg-brand-50 disabled:opacity-60", children: createCampaign.isPending ? 'Scheduling…' : sendLabel })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 pb-10", children: _jsxs("div", { className: "mx-auto max-w-[1280px] space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "w-[70px] shrink-0 text-[15px] text-ink-muted", children: "From" }), _jsxs("div", { className: "relative", children: [_jsx("select", { value: activeSender?.id ?? '', onChange: (e) => setSenderId(e.target.value), "aria-label": "From address", className: "cursor-pointer appearance-none rounded-lg bg-field py-2.5 pl-4 pr-10 text-[15px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-100", children: (senders.data ?? []).map((sender) => (_jsx("option", { value: sender.id, children: sender.fromEmail }, sender.id))) }), _jsx("span", { className: "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted", children: "\u25BE" })] })] }), _jsx(RecipientInput, { value: recipients, onChange: setRecipients, onNotify: notify, error: errors.recipients }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "w-[70px] shrink-0 text-[15px] text-ink-muted", children: "Subject" }), _jsxs("div", { className: "flex-1", children: [_jsx("input", { value: subject, onChange: (e) => setSubject(e.target.value), placeholder: "Subject", "aria-label": "Subject", className: cn('w-full border-b bg-transparent pb-2 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none', errors.subject ? 'border-red-400' : 'border-line') }), errors.subject && _jsx("p", { className: "mt-1.5 text-xs text-red-600", children: errors.subject })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsx("label", { className: "text-[15px] text-ink", children: "Delay between 2 emails" }), _jsx("input", { type: "number", min: 0, value: delaySeconds, onChange: (e) => setDelaySeconds(e.target.value), placeholder: "00", "aria-label": "Delay between emails in seconds", className: "h-11 w-[86px] rounded-lg border border-line px-4 text-center text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-100" }), _jsx("label", { className: "ml-2 text-[15px] text-ink", children: "Hourly Limit" }), _jsx("input", { type: "number", min: 1, value: hourlyLimit, onChange: (e) => setHourlyLimit(e.target.value), placeholder: "00", "aria-label": "Hourly limit", className: "h-11 w-[86px] rounded-lg border border-line px-4 text-center text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-100" }), (errors.delay || errors.limit) && (_jsx("p", { className: "text-xs text-red-600", children: errors.delay ?? errors.limit }))] }), sendAt && (_jsxs("div", { className: "flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-700", children: [_jsx(ClockIcon, { className: "h-4 w-4" }), "Sending starts ", sendAt.toLocaleString(), _jsx("button", { onClick: () => setSendAt(null), className: "ml-2 underline transition-opacity hover:opacity-70", children: "send immediately instead" })] })), attachments.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: attachments.map((file, index) => (_jsxs("span", { className: "inline-flex items-center gap-2 rounded-lg bg-field px-3 py-1.5 text-[13px] text-ink", children: [file.name, _jsx("button", { onClick: () => setAttachments((c) => c.filter((_, i) => i !== index)), "aria-label": `Remove ${file.name}`, className: "text-ink-faint hover:text-red-600", children: "\u00D7" })] }, `${file.name}-${index}`))) })), _jsxs("div", { children: [_jsx(RichTextEditor, { html: bodyHtml, onChange: setBodyHtml, placeholder: "Type Your Reply..." }), errors.body && _jsx("p", { className: "mt-1.5 text-xs text-red-600", children: errors.body })] })] }) })] }));
}
