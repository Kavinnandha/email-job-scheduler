import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { UploadIcon } from '@/components/icons';
import { ACCEPTED_LEAD_TYPES, extractEmails, parseLeadFile } from '@/lib/csv';

export interface RecipientInputProps {
  value: string[];
  onChange: (recipients: string[]) => void;
  onNotify: (message: string, tone: 'success' | 'error' | 'info') => void;
  error?: string;
}

/** How many chips to render before collapsing the rest into a "+N" pill. */
const VISIBLE_CHIPS = 3;

export function RecipientInput({ value, onChange, onNotify, error }: RecipientInputProps) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFromText = (text: string) => {
    const { emails } = extractEmails(text);
    if (emails.length === 0) return false;

    // De-duplicate against what is already staged, not just within the input.
    const merged = [...new Set([...value, ...emails])];
    onChange(merged);
    return true;
  };

  const commitDraft = () => {
    if (!draft.trim()) return;
    if (addFromText(draft)) setDraft('');
    else onNotify('That does not look like an email address', 'error');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      commitDraft();
      return;
    }
    // Backspace on an empty input removes the last chip, which is the
    // behaviour every chip input has and users reach for without thinking.
    if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseLeadFile(file);
      if (parsed.emails.length === 0) {
        onNotify('No email addresses found in that file', 'error');
        return;
      }

      const before = value.length;
      const merged = [...new Set([...value, ...parsed.emails])];
      onChange(merged);

      const added = merged.length - before;
      const skipped = parsed.emails.length - added + parsed.duplicates;
      onNotify(
        `Added ${added} address${added === 1 ? '' : 'es'}${skipped > 0 ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}`,
        'success',
      );
    } catch {
      onNotify('Could not read that file', 'error');
    } finally {
      // Reset so re-selecting the same file fires change again.
      event.target.value = '';
    }
  };

  const shown = expanded ? value : value.slice(0, VISIBLE_CHIPS);
  const hidden = value.length - shown.length;

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="w-[70px] shrink-0 pt-2 text-[15px] text-ink-muted">To</span>

        <div
          className={cn(
            'flex min-h-[42px] flex-1 flex-wrap items-center gap-2 border-b pb-2',
            error ? 'border-red-400' : 'border-line',
          )}
        >
          {shown.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 px-3 py-1 text-[13px] text-ink"
            >
              {email}
              <button
                type="button"
                onClick={() => onChange(value.filter((e) => e !== email))}
                aria-label={`Remove ${email}`}
                className="text-ink-faint transition-colors hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}

          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-full border border-brand-500 px-3 py-1 text-[13px] text-ink transition-colors hover:bg-brand-50"
            >
              +{hidden}
            </button>
          )}

          {expanded && value.length > VISIBLE_CHIPS && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[13px] text-ink-muted underline"
            >
              show less
            </button>
          )}

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitDraft}
            onPaste={(e) => {
              // A pasted list should become chips immediately rather than
              // sitting in the input as one unusable blob.
              const text = e.clipboardData.getData('text');
              if (/[,;\n]/.test(text)) {
                e.preventDefault();
                addFromText(text);
              }
            }}
            placeholder={value.length === 0 ? 'recipient@example.com' : ''}
            aria-label="Recipients"
            className="min-w-[200px] flex-1 bg-transparent py-1 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex shrink-0 items-center gap-2 pt-1 text-[15px] font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          <UploadIcon className="h-[18px] w-[18px]" />
          Upload List
        </button>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_LEAD_TYPES}
          onChange={handleFile}
          className="sr-only"
        />
      </div>

      <div className="pl-[82px]">
        {error ? (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        ) : value.length > 0 ? (
          <p className="mt-1.5 text-xs text-ink-muted">
            {value.length} recipient{value.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
