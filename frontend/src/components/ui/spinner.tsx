import { Loader2 } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <Loader2
      className={`h-5 w-5 animate-spin text-[var(--primary)] ${className}`}
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
