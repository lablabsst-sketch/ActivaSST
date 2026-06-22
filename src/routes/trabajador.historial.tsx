import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX, ArrowLeft, Check, Clock, SkipForward } from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { StateError } from "@/components/states";
import { usePullToRefresh, PullIndicator } from "@/hooks/use-pull-to-refresh";

export const Route = createFileRoute("/trabajador/historial")({
  head: () => ({ meta: [{ title: "Historial — Activa SST" }] }),
  component: HistorialPage,
});

interface RegistroRow {
  id: string;
  estado: string;
  respondido_en: string;
  duracion_real_seg: number | null;
  programacion: {
    nombre: string | null;
    pausas_oficiales: { titulo: string | null } | null;
  } | null;
}

function HistorialPage() {
  const { usuario } = useUsuario();
  const trabajadorId = usuario?.id;
  const qc = useQueryClient();

  const registrosQuery = useQuery({
    queryKey: ["historial", trabajadorId],
    enabled: !!trabajadorId,
    queryFn: async (): Promise<RegistroRow[]> => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 30);
      const { data, error } = await supabase
        .from("pausa_registros")
        .select(
          "id, estado, respondido_en, duracion_real_seg, programacion:programaciones(nombre, pausas_oficiales(titulo))",
        )
        .eq("trabajador_id", trabajadorId!)
        .gte("respondido_en", desde.toISOString())
        .order("respondido_en", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RegistroRow[];
    },
  });

  const ptr = usePullToRefresh(() =>
    qc.invalidateQueries({ queryKey: ["historial"] }),
  );

  const registros = registrosQuery.data ?? [];

  const completadasMes = useMemo(() => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    return registros.filter(
      (r) => r.estado === "hecha" && new Date(r.respondido_en) >= inicioMes,
    ).length;
  }, [registros]);

  const grupos = useMemo(() => {
    const map = new Map<string, RegistroRow[]>();
    for (const r of registros) {
      const fecha = new Date(r.respondido_en).toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const arr = map.get(fecha) ?? [];
      arr.push(r);
      map.set(fecha, arr);
    }
    return Array.from(map.entries());
  }, [registros]);

  return (
    <AppShell>
      <PullIndicator {...ptr} />
      <section className="flex flex-col gap-4 pt-2">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi actividad</p>
          <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{completadasMes}</span>{" "}
            pausa{completadasMes === 1 ? "" : "s"} completada{completadasMes === 1 ? "" : "s"} este mes.
          </p>
        </header>

        {registrosQuery.isLoading && (
          <div className="space-y-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {registrosQuery.isError && (
          <StateError
            onRetry={() => registrosQuery.refetch()}
            message={registrosQuery.error.message}
          />
        )}

        {!registrosQuery.isLoading && !registrosQuery.isError && registros.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarX className="size-12 text-muted-foreground/40" aria-hidden />
              <div className="space-y-1">
                <p className="font-medium">Aún no hay nada por aquí</p>
                <p className="text-xs text-muted-foreground">
                  Cuando hagas tu primera pausa aparecerá aquí.
                </p>
              </div>
              <Button asChild>
                <Link to="/trabajador">
                  <ArrowLeft className="mr-1.5 size-4" aria-hidden /> Volver a inicio
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {grupos.map(([fecha, items]) => (
          <Card key={fecha}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize text-muted-foreground">{fecha}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ul className="divide-y">
                {items.map((r) => (
                  <li key={r.id} className="py-2.5 flex items-start gap-3">
                    <EstadoIcon estado={r.estado} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium truncate">
                        {r.programacion?.pausas_oficiales?.titulo ??
                          r.programacion?.nombre ??
                          "Pausa"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.respondido_en).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.duracion_real_seg != null && r.estado === "hecha" && (
                          <> · {Math.round(r.duracion_real_seg / 60)} min</>
                        )}
                      </p>
                    </div>
                    <EstadoBadge estado={r.estado} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}

function EstadoIcon({ estado }: { estado: string }) {
  if (estado === "hecha")
    return (
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Check className="size-4" aria-hidden />
      </div>
    );
  if (estado === "postpuesta")
    return (
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary">
        <Clock className="size-4" aria-hidden />
      </div>
    );
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <SkipForward className="size-4" aria-hidden />
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    hecha: { label: "Completada", variant: "default" },
    postpuesta: { label: "Postpuesta", variant: "secondary" },
    omitida: { label: "Omitida", variant: "outline" },
  };
  const cfg = map[estado] ?? { label: estado, variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className="shrink-0">
      {cfg.label}
    </Badge>
  );
}
