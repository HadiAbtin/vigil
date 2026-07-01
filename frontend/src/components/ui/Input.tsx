import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

const fieldBase =
  "w-full rounded-lg border border-vigil-border bg-vigil-surface-2 px-3 py-2 text-sm text-vigil-text placeholder:text-vigil-text-faint outline-none transition-colors focus:border-vigil-cyan/60 focus:ring-2 focus:ring-vigil-cyan/20";

function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-vigil-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-vigil-text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, ...props }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <input className={clsx(fieldBase, className)} {...props} />
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Select({ label, hint, error, className, children, ...props }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <select className={clsx(fieldBase, "cursor-pointer", className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, className, ...props }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <textarea className={clsx(fieldBase, "min-h-20 resize-y", className)} {...props} />
    </Field>
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-vigil-text-dim">
      <input type="checkbox" className="size-4 accent-vigil-cyan" {...props} />
      {label}
    </label>
  );
}
