"use client";

import { forwardRef, type TextareaHTMLAttributes, useId } from "react";
import { fieldBase } from "./input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = "", id, ...props }, ref) => {
    const generated = useId();
    const areaId = id ?? generated;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={areaId} className="text-sm font-medium text-fg">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={`${fieldBase} resize-y leading-relaxed ${error ? "border-[var(--err)]" : ""} ${className}`}
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
Textarea.displayName = "Textarea";
