import { useEffect, useState } from "react";
import { useServiceWorkerStatus } from "@/hooks/use-service-worker-status";

export function ServiceWorkerBadge() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { state, scope, isPreview } = useServiceWorkerStatus();

  // SSR + first client render emit the same placeholder to avoid hydration mismatch.
  if (!mounted) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        SW: …
      </span>
    );
  }

  const colorMap: Record<string, string> = {
    unsupported: "bg-muted text-muted-foreground",
    unregistered: "bg-destructive/10 text-destructive",
    installing: "bg-accent text-accent-foreground animate-pulse",
    installed: "bg-accent text-accent-foreground",
    waiting: "bg-accent text-accent-foreground",
    activating: "bg-accent text-accent-foreground animate-pulse",
    activated: "bg-primary/10 text-primary",
    redundant: "bg-destructive/10 text-destructive",
  };

  const labelMap: Record<string, string> = {
    unsupported: "SW: no soportado",
    unregistered: "SW: sin registrar",
    installing: "SW: instalando…",
    installed: "SW: instalado",
    waiting: "SW: esperando…",
    activating: "SW: activando…",
    activated: "SW: activo",
    redundant: "SW: redundante",
  };

  if (isPreview) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Preview: SW desactivado
      </span>
    );
  }

  return (
    <span
      title={`Scope: ${scope ?? "—"}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colorMap[state] ?? "bg-muted text-muted-foreground"}`}
    >
      {labelMap[state] ?? state}
    </span>
  );
}

