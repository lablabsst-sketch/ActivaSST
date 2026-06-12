import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listarSolicitudesArcoEmpresa,
  resolverSolicitudArco,
} from "@/lib/api/arco.functions";

export const Route = createFileRoute("/prevencionista/solicitudes-arco")({
  head: () => ({ meta: [{ title: "Solicitudes Habeas Data — Activa SST" }] }),
  component: SolicitudesPage,
});

const TIPO_LABEL: Record<string, string> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Cancelación / eliminación",
  oposicion: "Oposición",
  revocacion: "Revocación consentimiento",
};

function diasHabilesDesde(iso: string): number {
  const start = new Date(iso);
  let days = 0;
  const today = new Date();
  const cursor = new Date(start);
  while (cursor < today) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days++;
  }
  return days;
}

function SolicitudesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listarSolicitudesArcoEmpresa);
  const resolver = useServerFn(resolverSolicitudArco);

  const q = useQuery({
    queryKey: ["arco-empresa"],
    queryFn: () => list(),
  });

  const m = useMutation({
    mutationFn: (vars: { id: string; estado: "resuelta" | "rechazada"; respuesta: string }) =>
      resolver({ data: vars }),
    onSuccess: () => {
      toast.success("Solicitud actualizada");
      qc.invalidateQueries({ queryKey: ["arco-empresa"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-2">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Habeas Data</p>
          <h1 className="text-2xl font-bold tracking-tight">Solicitudes ARCO</h1>
          <p className="text-xs text-muted-foreground mt-1">
            SLA legal: 10 días hábiles para responder (Ley 1581/2012).
          </p>
        </header>

        {q.isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : q.error ? (
          <Card>
            <CardContent role="alert" className="pt-6 text-sm text-destructive">
              No se pudieron cargar las solicitudes.
            </CardContent>
          </Card>
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground text-center">
              No hay solicitudes registradas.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {q.data!.map((s) => (
              <SolicitudCard
                key={s.id}
                s={s}
                onResolve={(estado, respuesta) =>
                  m.mutate({ id: s.id, estado, respuesta })
                }
                pending={m.isPending}
              />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

type Sol = Awaited<ReturnType<typeof listarSolicitudesArcoEmpresa>>[number];

function SolicitudCard({
  s,
  onResolve,
  pending,
}: {
  s: Sol;
  onResolve: (estado: "resuelta" | "rechazada", respuesta: string) => void;
  pending: boolean;
}) {
  const [respuesta, setRespuesta] = useState("");
  const dias = diasHabilesDesde(s.created_at);
  const slaWarn = s.estado === "pendiente" && dias >= 8;
  const slaBreach = s.estado === "pendiente" && dias > 10;
  const usuario = (s as Sol & { usuarios?: { nombre?: string; email?: string } | null }).usuarios;

  return (
    <li>
      <Card>
        <CardHeader className="space-y-1 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{TIPO_LABEL[s.tipo] ?? s.tipo}</CardTitle>
            <Badge variant={s.estado === "pendiente" ? "default" : "secondary"}>
              {s.estado}
            </Badge>
            {slaBreach && <Badge variant="destructive">SLA vencido ({dias}d)</Badge>}
            {slaWarn && !slaBreach && <Badge variant="outline">SLA pronto ({dias}d)</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {usuario?.nombre ?? "Usuario"} · {usuario?.email ?? ""} ·{" "}
            {new Date(s.created_at).toLocaleString()}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="whitespace-pre-wrap">{s.descripcion}</p>
          {s.respuesta && (
            <p className="rounded-md bg-muted p-2 text-xs">
              <strong>Respuesta:</strong> {s.respuesta}
            </p>
          )}
          {s.estado === "pendiente" || s.estado === "en_revision" ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Respuesta al titular (queda registrada)"
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={pending || respuesta.trim().length < 3}
                  onClick={() => onResolve("resuelta", respuesta.trim())}
                >
                  Marcar resuelta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={pending || respuesta.trim().length < 3}
                  onClick={() => onResolve("rechazada", respuesta.trim())}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
