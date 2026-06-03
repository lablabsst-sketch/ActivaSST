import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Bell, Users, ArrowRight } from "lucide-react";
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

            <KpiPending icon={Activity} label="Pausas hoy" />
            <KpiPending icon={BarChart3} label="Adherencia" />
            <KpiPending icon={Bell} label="Alertas" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Programa activo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Aún no has configurado programas de pausas activas.
              </p>
            </CardContent>
          </Card>
        </section>
      </TooltipProvider>
    </AppShell>
  );
}

function KpiPending({
  icon: Icon,
  label,
}: {
  icon: typeof Activity;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="cursor-help">
          <CardHeader className="pb-2">
            <Icon className="size-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>
        Disponible cuando haya programaciones activas (T080+).
      </TooltipContent>
    </Tooltip>
  );
}
