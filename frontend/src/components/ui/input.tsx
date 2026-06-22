"use client";

import { forwardRef, type InputHTMLAttributes, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const fieldBase =
  "w-full rounded-md border border-[var(--border)] bg-surface px-3 py-2 text-sm text-fg placeholder:text-faint focus-ring transition-colors disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = "", id, ...props }, ref) => {
    const generated = useId();
    const inputId = id ?? generated;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-fg">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${fieldBase} ${error ? "border-[var(--err)]" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error ? (
          <p className="text-xs text-[var(--err)]">{error}</p>
        ) : hint ? (
          <p className="text-xs text-faint">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export { fieldBase };
