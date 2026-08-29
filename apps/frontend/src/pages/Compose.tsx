import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreateCampaignRequest } from '@repo/shared';
import { errorMessage } from '@/api/client';
import { ArrowLeftIcon, ClockIcon, PaperclipIcon } from '@/components/icons';
import { RecipientInput } from '@/components/compose/RecipientInput';
import { RichTextEditor } from '@/components/compose/RichTextEditor';
import { SendLaterPopover } from '@/components/compose/SendLaterPopover';
import { useToast } from '@/components/ui/Toast';
import { useCreateCampaign, useSenders } from '@/hooks/useEmails';
import { htmlToPlainText } from '@/lib/html';
import { cn } from '@/lib/cn';

/**
 * Sentinel for "spread this campaign across every active sender".
 *
 * Selecting it omits senderIds from the request, which is what makes the
 * backend round-robin the recipients over the whole pool - each sender then
 * carries its own share of the hourly ceiling instead of one account
 * absorbing the entire campaign.
 */
const ALL_SENDERS = 'all';

export function ComposePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const senders = useSenders();
  const createCampaign = useCreateCampaign();

  const [senderId, setSenderId] = useState<string>(ALL_SENDERS);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [sendAt, setSendAt] = useState<Date | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const attachmentRef = useRef<HTMLInputElement>(null);

  // Null means the whole pool. A stale id - a sender retired since the page
  // loaded - also resolves to null, so the campaign falls back to the pool
  // rather than being pinned to whichever sender happens to be first.
  const selectedSender = useMemo(
    () => (senderId === ALL_SENDERS ? null : (senders.data?.find((s) => s.id === senderId) ?? null)),
    [senders.data, senderId],
  );

  const handleAttach = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setAttachments((current) => [...current, ...files]);
    notify(
      `${files.length} file${files.length === 1 ? '' : 's'} attached. Attachments are staged in the browser only — this scheduler sends the message body.`,
      'info',
    );
    event.target.value = '';
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const plain = htmlToPlainText(bodyHtml).trim();

    if (recipients.length === 0) next.recipients = 'Add at least one recipient';
    if (!subject.trim()) next.subject = 'Subject is required';
    if (!plain) next.body = 'Message body is required';

    if (delaySeconds && Number(delaySeconds) < 0) next.delay = 'Must be 0 or more';
    if (hourlyLimit && Number(hourlyLimit) < 1) next.limit = 'Must be at least 1';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;

    const payload: CreateCampaignRequest = {
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
      // Omitted on purpose when no single sender is chosen: the backend then
      // round-robins across every active sender.
      ...(selectedSender ? { senderIds: [selectedSender.id] } : {}),
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="flex items-center gap-4 px-6 py-4">
        <button
          onClick={() => navigate('/')}
          aria-label="Back"
          className="rounded-lg p-1 text-ink transition-colors hover:bg-field"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>

        <h1 className="flex-1 text-[22px] font-medium text-ink">Compose New Email</h1>

        <button
          type="button"
          onClick={() => attachmentRef.current?.click()}
          aria-label="Attach files"
          className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-field"
        >
          <PaperclipIcon className="h-[21px] w-[21px]" />
          {attachments.length > 0 && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
              {attachments.length}
            </span>
          )}
        </button>
        <input ref={attachmentRef} type="file" multiple onChange={handleAttach} className="sr-only" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setSendLaterOpen((v) => !v)}
            aria-label="Schedule send"
            aria-expanded={sendLaterOpen}
            className={cn(
              'rounded-lg p-2 transition-colors hover:bg-field',
              sendAt ? 'text-brand-500' : 'text-ink-muted',
            )}
          >
            <ClockIcon className="h-[21px] w-[21px]" />
          </button>

          {sendLaterOpen && (
            <SendLaterPopover
              value={sendAt}
              onApply={setSendAt}
              onClose={() => setSendLaterOpen(false)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={createCampaign.isPending}
          className="h-11 rounded-full border border-brand-500 px-8 text-[15px] font-medium text-brand-500 transition-colors hover:bg-brand-50 disabled:opacity-60"
        >
          {createCampaign.isPending ? 'Scheduling…' : sendLabel}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-[70px] shrink-0 text-[15px] text-ink-muted">From</span>
            <div className="relative">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                aria-label="From address"
                className="cursor-pointer appearance-none rounded-lg bg-field py-2.5 pl-4 pr-10 text-[15px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value={ALL_SENDERS}>
                  All senders{senders.data ? ` (${senders.data.length})` : ''} — round-robin
                </option>
                {(senders.data ?? []).map((sender) => (
                  <option key={sender.id} value={sender.id}>
                    {sender.fromEmail}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted">
                ▾
              </span>
            </div>
          </div>

          <RecipientInput
            value={recipients}
            onChange={setRecipients}
            onNotify={notify}
            error={errors.recipients}
          />

          <div className="flex items-center gap-3">
            <span className="w-[70px] shrink-0 text-[15px] text-ink-muted">Subject</span>
            <div className="flex-1">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                aria-label="Subject"
                className={cn(
                  'w-full border-b bg-transparent pb-2 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none',
                  errors.subject ? 'border-red-400' : 'border-line',
                )}
              />
              {errors.subject && <p className="mt-1.5 text-xs text-red-600">{errors.subject}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="text-[15px] text-ink">Delay between 2 emails</label>
            <input
              type="number"
              min={0}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              placeholder="00"
              aria-label="Delay between emails in seconds"
              className="h-11 w-[86px] rounded-lg border border-line px-4 text-center text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-100"
            />

            <label className="ml-2 text-[15px] text-ink">Hourly Limit</label>
            <input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              placeholder="00"
              aria-label="Hourly limit"
              className="h-11 w-[86px] rounded-lg border border-line px-4 text-center text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-100"
            />

            {(errors.delay || errors.limit) && (
              <p className="text-xs text-red-600">{errors.delay ?? errors.limit}</p>
            )}
          </div>

          {sendAt && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
              <ClockIcon className="h-4 w-4" />
              Sending starts {sendAt.toLocaleString()}
              <button
                onClick={() => setSendAt(null)}
                className="ml-2 underline transition-opacity hover:opacity-70"
              >
                send immediately instead
              </button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-field px-3 py-1.5 text-[13px] text-ink"
                >
                  {file.name}
                  <button
                    onClick={() => setAttachments((c) => c.filter((_, i) => i !== index))}
                    aria-label={`Remove ${file.name}`}
                    className="text-ink-faint hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <RichTextEditor
              html={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Type Your Reply..."
            />
            {errors.body && <p className="mt-1.5 text-xs text-red-600">{errors.body}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
