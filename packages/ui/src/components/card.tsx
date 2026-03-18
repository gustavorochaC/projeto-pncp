import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/utils";

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200/70 bg-[var(--color-panel)] p-6 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.22)] backdrop-blur dark:border-slate-600/70 dark:shadow-[0_12px_40px_-18px_rgba(0,0,0,0.3)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
