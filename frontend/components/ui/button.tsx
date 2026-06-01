import * as React from "react";
import { cn } from "@/components/ui/utils";

export function Button({ className, disabled, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "btn-calculate inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wide text-white dark:text-white",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
