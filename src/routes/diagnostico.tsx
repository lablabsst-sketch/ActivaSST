import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2, XCircle, RefreshCw, Globe, AlertTriangle } from "lucide-react";
import { useServiceWorkerStatus, type ServiceWorkerInfo } from "@/hooks/use-service-worker-status";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/diagnostico")({
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const sw = useServiceWorkerStatus();

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Diagnóstico PWA</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Estado del Service Worker y compatibilidad del navegador.
        </p>

        <SwStatusCard sw={sw} />

        {sw.isPreview && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p>
              Estás en un host de preview. El Service Worker está desactivado intencionalmente para
              evitar conflictos con el editor de Lovable. Publica la app para ver el SW activo.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Acciones</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-3.5" /> Recargar página
            </button>
            <button
              onClick={async () => {
                if (!("serviceWorker" in navigator)) return;
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
                window.location.reload();
              }}
              disabled={sw.state === "unregistered" || sw.state === "unsupported"}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <XCircle className="size-3.5" /> Desregistrar SW
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SwStatusCard({ sw }: { sw: ServiceWorkerInfo }) {
  const active = sw.state === "activated" || sw.state === "activating";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {active ? (
            <CheckCircle2 className="size-5 text-primary" />
          ) : (
            <XCircle className="size-5 text-destructive" />
          )}
          Service Worker
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StatusRow label="Estado" value={sw.state} highlight={active} />
        <StatusRow label="Scope" value={sw.scope ?? "—"} />
        <StatusRow label="Script URL" value={sw.scriptURL ?? "—"} />
        <StatusRow label="Update via cache" value={sw.updateViaCache ?? "—"} />
        <StatusRow label="Host preview" value={sw.isPreview ? "Sí" : "No"} />
        <StatusRow
          label="Navigator online"
          value={typeof navigator !== "undefined" && navigator.onLine ? "Sí" : "No"}
        />
        <StatusRow
          label="Push soportado"
          value={
            typeof window !== "undefined" && "PushManager" in window ? "Sí" : "No"
          }
        />
        <StatusRow
          label="Notificaciones soportadas"
          value={
            typeof window !== "undefined" && "Notification" in window ? "Sí" : "No"
          }
        />
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          highlight ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
        }`}
      >
        {label === "Scope" && value !== "—" && <Globe className="size-3" />}
        {value}
      </span>
    </div>
  );
}
