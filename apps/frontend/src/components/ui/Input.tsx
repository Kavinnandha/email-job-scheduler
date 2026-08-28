import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

const FIELD_STYLES =
  'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50';

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, hint, error, htmlFor, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {/* Error takes precedence over hint so the two never stack and compete. */}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, id, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrapper label={label} hint={hint} error={error} htmlFor={inputId}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_STYLES, error && 'border-red-400 focus:border-red-500', className)}
        {...rest}
      />
    </FieldWrapper>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, className, id, ...rest }: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrapper label={label} hint={hint} error={error} htmlFor={inputId}>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_STYLES, 'resize-y', error && 'border-red-400', className)}
        {...rest}
      />
    </FieldWrapper>
  );
}
