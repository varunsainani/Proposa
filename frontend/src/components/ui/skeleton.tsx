import type { HTMLAttributes } from "react";

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`shimmer rounded-md ${className}`}
      aria-hidden
      {...props}
    />
  );
}
