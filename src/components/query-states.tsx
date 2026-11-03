import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/** Consistent, accessible error panel with an explicit retry action. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="mx-auto h-6 w-6 text-destructive" />
      <h3 className="mt-3 text-sm font-medium tracking-tight text-foreground">{title}</h3>
      {message ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      ) : null}
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-5 border-neutral-800 bg-surface text-foreground hover:bg-neutral-800/50"
        >
          <RefreshCw aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
};

/** Consistent empty state — used for empty libraries, chapters, comments… */
export function EmptyState({ icon: Icon, title, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-neutral-800 bg-surface/30 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="mx-auto h-6 w-6 text-muted-foreground" /> : null}
      <p className="mt-3 text-sm font-medium tracking-tight text-foreground">{title}</p>
      {message ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
