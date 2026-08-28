import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { CreateCampaignRequest } from '@repo/shared';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCreateCampaign, useSenders } from '@/hooks/useEmails';
import { ACCEPTED_LEAD_TYPES, parseLeadFile, type ParsedLeads } from '@/lib/csv';
import { toDateTimeLocalValue } from '@/lib/datetime';

export interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: string;
  hourlyLimit: string;
  senderIds: string[];
}

const initialState = (): FormState => ({
  subject: '',
  body: '',
  // Default to one minute out, giving the user room to review before sending.
  startTime: toDateTimeLocalValue(new Date(Date.now() + 60_000)),
  delaySeconds: '2',
  hourlyLimit: '100',
  senderIds: [],
});

export function ComposeModal({ open, onClose }: ComposeModalProps) {
  const { notify } = useToast();
  const senders = useSenders();
  const createCampaign = useCreateCampaign();

  const [form, setForm] = useState<FormState>(initialState);
  const [leads, setLeads] = useState<ParsedLeads | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const reset = () => {
    setForm(initialState());
    setLeads(null);
    setFileName(null);
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseLeadFile(file);
      setLeads(parsed);
      setFileName(file.name);
      if (parsed.emails.length === 0) {
        setErrors((c) => ({ ...c, recipients: 'No email addresses found in this file' }));
      } else {
        setErrors((c) => {
          const next = { ...c };
          delete next.recipients;
          return next;
        });
      }
    } catch {
      notify('Could not read that file', 'error');
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!form.subject.trim()) next.subject = 'Subject is required';
    if (!form.body.trim()) next.body = 'Body is required';
    if (!leads || leads.emails.length === 0) next.recipients = 'Upload a file with at least one address';
    if (!form.startTime) next.startTime = 'Start time is required';

    const delay = Number(form.delaySeconds);
    if (Number.isNaN(delay) || delay < 0) next.delaySeconds = 'Must be 0 or more';

    const limit = Number(form.hourlyLimit);
    if (!Number.isInteger(limit) || limit < 1) next.hourlyLimit = 'Must be at least 1';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate() || !leads) return;

    const payload: CreateCampaignRequest = {
      subject: form.subject.trim(),
      body: form.body,
      recipients: leads.emails,
      // datetime-local has no timezone; the Date constructor reads it as local
      // time, which is what the user picked.
      startTime: new Date(form.startTime).toISOString(),
      delaySeconds: Number(form.delaySeconds),
      hourlyLimit: Number(form.hourlyLimit),
      ...(form.senderIds.length > 0 ? { senderIds: form.senderIds } : {}),
    };

    createCampaign.mutate(payload, {
      onSuccess: (result) => {
        const skipped = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
        notify(`Scheduled ${result.scheduled} emails${skipped}`, 'success');
        handleClose();
      },
      onError: (error) => notify(errorMessage(error), 'error'),
    });
  };

  const toggleSender = (id: string) => {
    update(
      'senderIds',
      form.senderIds.includes(id)
        ? form.senderIds.filter((s) => s !== id)
        : [...form.senderIds, id],
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Compose new email"
      description="Upload your leads, set the pace, and schedule the campaign."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="compose-form" loading={createCampaign.isPending}>
            Schedule
          </Button>
        </>
      }
    >
      <form id="compose-form" onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Subject"
          placeholder="Quick question about your team"
          value={form.subject}
          error={errors.subject}
          onChange={(e) => update('subject', e.target.value)}
        />

        <Textarea
          label="Body"
          rows={6}
          placeholder="Hi there,&#10;&#10;I noticed…"
          value={form.body}
          error={errors.body}
          onChange={(e) => update('body', e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Leads</label>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              errors.recipients
                ? 'border-red-300 bg-red-50/40'
                : 'border-surface-border bg-surface-muted hover:border-brand-500 hover:bg-brand-50/40'
            }`}
          >
            <input
              type="file"
              accept={ACCEPTED_LEAD_TYPES}
              className="sr-only"
              onChange={handleFile}
            />
            <svg
              className="mb-2 h-6 w-6 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-medium text-slate-700">
              {fileName ?? 'Upload a CSV or text file'}
            </span>
            <span className="mt-0.5 text-xs text-slate-500">
              Any layout works — addresses are detected automatically
            </span>
          </label>

          {leads && leads.emails.length > 0 && (
            <p className="text-xs text-emerald-700">
              <span className="font-semibold">{leads.emails.length}</span> email addresses detected
              {leads.duplicates > 0 && ` (${leads.duplicates} duplicates removed)`}
            </p>
          )}
          {errors.recipients && <p className="text-xs text-red-600">{errors.recipients}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            type="datetime-local"
            label="Start time"
            value={form.startTime}
            error={errors.startTime}
            onChange={(e) => update('startTime', e.target.value)}
          />
          <Input
            type="number"
            min={0}
            label="Delay (seconds)"
            hint="Between each send"
            value={form.delaySeconds}
            error={errors.delaySeconds}
            onChange={(e) => update('delaySeconds', e.target.value)}
          />
          <Input
            type="number"
            min={1}
            label="Hourly limit"
            hint="Per campaign"
            value={form.hourlyLimit}
            error={errors.hourlyLimit}
            onChange={(e) => update('hourlyLimit', e.target.value)}
          />
        </div>

        {senders.data && senders.data.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Senders{' '}
              <span className="font-normal text-slate-400">
                (none selected uses all {senders.data.length})
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {senders.data.map((sender) => {
                const selected = form.senderIds.includes(sender.id);
                return (
                  <button
                    key={sender.id}
                    type="button"
                    onClick={() => toggleSender(sender.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                      selected
                        ? 'bg-brand-50 text-brand-700 ring-brand-500/40'
                        : 'bg-white text-slate-600 ring-surface-border hover:bg-slate-50'
                    }`}
                  >
                    {sender.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
