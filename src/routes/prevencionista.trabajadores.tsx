import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { AltaTrabajadorDialog } from "@/components/alta-trabajador-dialog";
import type { Database } from "@/integrations/supabase/types";

type Trabajador = Database["public"]["Tables"]["usuarios"]["Row"];
type Plan = Database["public"]["Tables"]["planes"]["Row"];

export const Route = createFileRoute("/prevencionista/trabajadores")({
  head: () => ({
    meta: [{ title: "Trabajadores — Activa SST" }],
  }),
  component: TrabajadoresPage,
});

function TrabajadoresPage() {
  const { usuario, loading: loadingUser } = useUsuario();
  const [openAlta, setOpenAlta] = useState(false);

  const trabajadoresQuery = useQuery({
    queryKey: ["trabajadores", usuario?.empresa_id],
    enabled: !!usuario?.empresa_id,
    queryFn: async (): Promise<Trabajador[]> => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("empresa_id", usuario!.empresa_id)
        .eq("rol", "trabajador")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const planQuery = useQuery({
    queryKey: ["plan-empresa", usuario?.empresa_id],
    enabled: !!usuario?.empresa_id,
    queryFn: async (): Promise<Plan | null> => {
      const { data: emp, error: empErr } = await supabase
        .from("empresas")
        .select("plan_id")
        .eq("id", usuario!.empresa_id)
        .single();
      if (empErr) throw empErr;
      if (!emp?.plan_id) return null;
      const { data, error } = await supabase
        .from("planes")
        .select("*")
        .eq("id", emp.plan_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const trabajadores = trabajadoresQuery.data ?? [];
  const plan = planQuery.data;

  const activos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo" || t.estado === "pendiente").length,
    [trabajadores],
  );

  const cupoLleno = !!plan && activos >= plan.max_trabajadores;

  const handleDesactivar = async (id: string) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ estado: "inactivo" })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo desactivar el trabajador", { description: error.message });
      return;
    }
    toast.success("Trabajador desactivado");
    trabajadoresQuery.refetch();
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipo</p>
          <h1 className="text-2xl font-bold tracking-tight">Trabajadores</h1>
          <p className="text-sm text-muted-foreground">
            Da de alta a quienes recibirán las pausas activas. Solo los correos que registres
            podrán iniciar sesión.
          </p>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                Cupo del plan
              </CardTitle>
              <CardDescription className="text-xs">
                Se cuentan trabajadores activos y pendientes de primer login.
              </CardDescription>
            </div>
            <Badge variant={cupoLleno ? "destructive" : "secondary"}>
              {plan
                ? `${activos} / ${plan.max_trabajadores} — Plan ${plan.nombre}`
                : "Cargando plan…"}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              onClick={() => setOpenAlta(true)}
              disabled={loadingUser || !plan || cupoLleno}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-1.5 size-4" />
              Agregar trabajador
            </Button>
            {cupoLleno && (
              <p className="mt-2 text-xs text-destructive">
                Has alcanzado el límite del plan {plan?.nombre}. Actualiza tu plan para sumar más.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listado</CardTitle>
            <CardDescription className="text-xs">
              {trabajadoresQuery.isLoading
                ? "Cargando…"
                : `${trabajadores.length} trabajador(es) registrados`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trabajadores.length === 0 && !trabajadoresQuery.isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Aún no hay trabajadores. Agrega el primero para empezar.
                      </TableCell>
                    </TableRow>
                  )}
                  {trabajadores.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nombre || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.documento || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{t.email}</TableCell>
                      <TableCell>
                        <EstadoBadge estado={t.estado} />
                      </TableCell>
                      <TableCell className="text-right">
                        {t.estado !== "inactivo" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDesactivar(t.id)}
                          >
                            Desactivar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <AltaTrabajadorDialog
        open={openAlta}
        onOpenChange={setOpenAlta}
        empresaId={usuario?.empresa_id}
        onSuccess={() => trabajadoresQuery.refetch()}
      />
    </AppShell>
  );
}

function EstadoBadge({ estado }: { estado: Trabajador["estado"] }) {
  const map = {
    activo: { label: "Activo", variant: "default" as const },
    pendiente: { label: "Pendiente", variant: "secondary" as const },
    inactivo: { label: "Inactivo", variant: "outline" as const },
  };
  const cfg = map[estado];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
