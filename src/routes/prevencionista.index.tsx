import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Bell, Users, ArrowRight, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { alertasBajaAdherencia } from "@/lib/api/empresa.functions";


export const Route = createFileRoute("/prevencionista/")({
  head: () => ({
    meta: [
      { title: "Panel del prevencionista — Activa SST" },
      {
        name: "description",
        content: "Gestiona programas de pausas activas, equipos y reportes SST.",
      },
    ],
  }),
  component: PrevencionistaPage,
});

function PrevencionistaPage() {
  const { usuario } = useUsuario();
  const empresaId = usuario?.empresa_id;

  const trabajadoresCount = useQuery({
    queryKey: ["trabajadores-count", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .eq("rol", "trabajador")
        .neq("estado", "inactivo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const programasActivosCount = useQuery({
    queryKey: ["progs-activas-count", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("programaciones")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .eq("activa", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pausasHoy = useQuery({
    queryKey: ["pausas-hoy", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: progs } = await supabase
        .from("programaciones")
        .select("id")
        .eq("empresa_id", empresaId!);
      const progIds = (progs ?? []).map((p) => p.id);
      if (progIds.length === 0) return 0;
      const { count, error } = await supabase
        .from("pausa_registros")
        .select("id", { count: "exact", head: true })
        .in("programacion_id", progIds)
        .eq("estado", "hecha")
        .gte("respondido_en", startOfDay.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  const adherencia7d = useQuery({
    queryKey: ["adherencia-7d", empresaId],
    enabled: !!empresaId && (programasActivosCount.data ?? 0) > 0,
    queryFn: async () => {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
      const { data: progs } = await supabase
        .from("programaciones")
        .select("id, dias_semana, horas, activa")
        .eq("empresa_id", empresaId!)
        .eq("activa", true);
      let denom = 0;
      const dias = 7;
      const now = new Date();
      for (let i = 0; i < dias; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dow = d.getDay();
        for (const p of progs ?? []) {
          if (p.dias_semana.includes(dow)) denom += p.horas.length;
        }
      }
      if (denom === 0) return { num: 0, denom: 0 };
      const progIds = (progs ?? []).map((p) => p.id);
      const { count } = await supabase
        .from("pausa_registros")
        .select("id", { count: "exact", head: true })
        .in("programacion_id", progIds)
        .eq("estado", "hecha")
        .gte("respondido_en", inicio.toISOString());
      const trabajadoresEmpresa = trabajadoresCount.data ?? 1;
      return { num: count ?? 0, denom: denom * Math.max(1, trabajadoresEmpresa) };
    },
  });

  const adherenciaPct =
    adherencia7d.data && adherencia7d.data.denom > 0
      ? Math.round((adherencia7d.data.num / adherencia7d.data.denom) * 100)
      : null;

  const alertasQuery = useQuery({
    queryKey: ["alertas-baja-adherencia", empresaId],
    enabled: !!empresaId,
    queryFn: () => alertasBajaAdherencia(),
  });


  return (
    <AppShell>
      <TooltipProvider delayDuration={150}>
        <section className="flex flex-col gap-5 pt-4">
          <header>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Panel</p>
            <h1 className="text-2xl font-bold tracking-tight">Prevencionista</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu resumen del programa de pausas activas.
            </p>
          </header>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/prevencionista/trabajadores"
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Card className="cursor-pointer transition hover:shadow-md group-hover:border-primary/40">
                <CardHeader className="pb-2">
                  <Users className="size-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {trabajadoresCount.isLoading ? "…" : (trabajadoresCount.data ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Trabajadores</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                    Ver lista <ArrowRight className="size-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <Activity className="size-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {pausasHoy.isLoading ? "…" : (pausasHoy.data ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Pausas hoy</p>
              </CardContent>
            </Card>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="cursor-help">
                  <CardHeader className="pb-2">
                    <BarChart3 className="size-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {adherenciaPct === null ? "—" : `${adherenciaPct}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">Adherencia 7d</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                {adherenciaPct === null
                  ? "Sin programaciones activas"
                  : "Completadas / programadas en los últimos 7 días"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/prevencionista/trabajadores"
                  search={
                    (alertasQuery.data?.count ?? 0) > 0
                      ? { alerta: "baja_adherencia" as const }
                      : {}
                  }
                  aria-label="Ver trabajadores con baja adherencia"
                  className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Card className="cursor-pointer transition hover:shadow-md hover:border-primary/40">
                    <CardHeader className="pb-2">
                      <Bell
                        className={
                          (alertasQuery.data?.count ?? 0) > 0
                            ? "size-5 text-destructive"
                            : "size-5 text-primary"
                        }
                      />
                    </CardHeader>
                    <CardContent>
                      <p
                        className={
                          (alertasQuery.data?.count ?? 0) > 0
                            ? "text-2xl font-bold text-destructive"
                            : "text-2xl font-bold"
                        }
                      >
                        {alertasQuery.isLoading
                          ? "…"
                          : alertasQuery.data?.sin_programaciones
                            ? "—"
                            : (alertasQuery.data?.count ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Alertas</p>
                    </CardContent>
                  </Card>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                {alertasQuery.data?.sin_programaciones
                  ? "Sin programaciones activas"
                  : "Trabajadores con adherencia <50% últimos 7 días"}
              </TooltipContent>
            </Tooltip>

          </div>

          <Link
            to="/prevencionista/programaciones"
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card className="cursor-pointer transition hover:shadow-md hover:border-primary/40">
              <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                <CalendarClock className="size-5 text-primary" />
                <CardTitle className="text-base">Programa activo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {programasActivosCount.isLoading
                    ? "Un momento…"
                    : (programasActivosCount.data ?? 0) === 0
                    ? "Aún no has configurado programaciones."
                    : `${programasActivosCount.data} programación${
                        programasActivosCount.data === 1 ? "" : "es"
                      } activa${programasActivosCount.data === 1 ? "" : "s"}.`}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                  Gestionar <ArrowRight className="size-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link
            to="/prevencionista/solicitudes-arco"
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card className="cursor-pointer transition hover:shadow-md hover:border-primary/40">
              <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                <CalendarClock className="size-5 text-primary" />
                <CardTitle className="text-base">Solicitudes Habeas Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Atiende solicitudes ARCO de tu equipo. SLA 10 días hábiles.
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                  Ver solicitudes <ArrowRight className="size-3" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </section>
      </TooltipProvider>
    </AppShell>
  );
}
