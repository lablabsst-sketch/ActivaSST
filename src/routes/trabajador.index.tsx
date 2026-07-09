import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PausaReminderBanner } from "@/components/pausa-reminder-banner";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import {
  proximosSlots,
  slotsHoyCount,
  slotsPendientesAhora,
  type ProgInput,
} from "@/lib/dias-horas";

export const Route = createFileRoute("/trabajador/")({
  head: () => ({ meta: [{ title: "Mis pausas — Activa SST" }] }),
  component: TrabajadorPage,
});

function TrabajadorPage() {
  const { usuario } = useUsuario();
  const empresaId = usuario?.empresa_id;
  const userId = usuario?.id;

  const tiposQ = useQuery({
    queryKey: ["mis-tipos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuario_tipos_trabajo")
        .select("tipo_id")
        .eq("usuario_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.tipo_id);
    },
  });

  const progsQ = useQuery({
    queryKey: ["progs-activas", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<ProgInput[]> => {
      const { data, error } = await supabase
        .from("programaciones")
        .select("id, pausa_oficial_id, nombre, dias_semana, horas, tipos_trabajo_objetivo, activa")
        .eq("empresa_id", empresaId!)
        .eq("activa", true);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        pausa_oficial_id: p.pausa_oficial_id,
        nombre: p.nombre,
        dias_semana: p.dias_semana,
        horas: p.horas,
        tipos_trabajo_objetivo: p.tipos_trabajo_objetivo,
      }));
    },
  });

  const registrosHoyQ = useQuery({
    queryKey: ["registros-hoy", userId],
    enabled: !!userId,
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("pausa_registros")
        .select("programacion_id, respondido_en, estado")
        .eq("trabajador_id", userId!)
        .gte("respondido_en", startOfDay.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const pausasMapQ = useQuery({
    queryKey: ["pausas-oficiales-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pausas_oficiales")
        .select("id, titulo, duracion_min");
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p]));
    },
  });

  // Reloj vivo: re-evalúa slots/recordatorio cada 30 s sin recargar la página.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const progs = progsQ.data ?? [];
  const tipos = tiposQ.data ?? [];
  const registrosHoy = registrosHoyQ.data ?? [];

  const pendientes = slotsPendientesAhora(progs, tipos, registrosHoy, now);
  const pendienteAhora = pendientes[0];
  const pendienteInfo = pendienteAhora
    ? pausasMapQ.data?.get(pendienteAhora.pausa_oficial_id)
    : undefined;

  const slots = proximosSlots(progs, tipos, now);
  const proxima = slots[0];
  const pausaInfo = proxima ? pausasMapQ.data?.get(proxima.pausa_oficial_id) : undefined;
  const totalHoy = slotsHoyCount(progs, tipos, now);
  const completadasHoy = registrosHoy.filter((r) => r.estado === "hecha").length;

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Hola{usuario?.nombre ? `, ${usuario.nombre.split(" ")[0]}` : ""} 👋
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Tu jornada activa</h1>
        </header>

        {pendienteAhora && (
          <PausaReminderBanner
            slot={pendienteAhora}
            titulo={pendienteInfo?.titulo}
            pendientesExtra={pendientes.length - 1}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próxima pausa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {progsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : proxima ? (
              <>
                <p className="text-3xl font-bold text-primary">{proxima.hora}</p>
                <p className="text-xs text-muted-foreground">
                  {pausaInfo?.titulo ?? proxima.nombre}
                  {pausaInfo ? ` · ${pausaInfo.duracion_min} min` : ""}
                </p>
                <Button asChild size="sm" className="mt-2">
                  <Link to="/trabajador/pausa/$id" params={{ id: proxima.programacion_id }}>
                    <Play className="size-4" /> Empezar
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tienes pausas programadas próximamente.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {completadasHoy} de {totalHoy} pausas completadas.
              {totalHoy > 0 && completadasHoy === totalHoy && " ¡Excelente!"}
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
