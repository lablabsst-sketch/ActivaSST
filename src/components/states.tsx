import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function StateLoading({ label = "Un momento…" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function StateEmpty({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctaHref?: any;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {icon ?? null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {ctaLabel && ctaHref && (
        <Button asChild>
          <Link to={ctaHref}>{ctaLabel}</Link>
        </Button>
      )}
      {ctaLabel && !ctaHref && onCta && (
        <Button onClick={onCta}>{ctaLabel}</Button>
      )}
    </div>
  );
}

export function StateError({
  onRetry,
  message,
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
      role="alert"
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Algo no salió bien. Reintenta o contacta soporte.
        </p>
        {message && (
          <p className="text-xs text-muted-foreground">{message}</p>
        )}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
