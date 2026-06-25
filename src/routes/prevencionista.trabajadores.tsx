import { useMemo, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Search, Pencil, Mail, AlertCircle, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AltaTrabajadorDialog } from "@/components/alta-trabajador-dialog";
import { EditTrabajadorDialog } from "@/components/edit-trabajador-dialog";
import { deleteWorker, resendInvite } from "@/lib/api/workers.functions";
import type { Database } from "@/integrations/supabase/types";

type Trabajador = Database["public"]["Tables"]["usuarios"]["Row"];
type Plan = Database["public"]["Tables"]["planes"]["Row"];

const searchSchema = z.object({
  alerta: z.enum(["baja_adherencia"]).optional(),
});

export const Route = createFileRoute("/prevencionista/trabajadores")({
  head: () => ({ meta: [{ title: "Trabajadores — Activa SST" }] }),
  validateSearch: searchSchema,
  component: TrabajadoresPage,
});

type FiltroEstado = "todos" | "activo" | "pendiente" | "inactivo";

function TrabajadoresPage() {
  const { usuario, loading: loadingUser } = useUsuario();
  const { alerta } = useSearch({ from: "/prevencionista/trabajadores" });
  const [openAlta, setOpenAlta] = useState(false);
  const [editTarget, setEditTarget] = useState<Trabajador | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trabajador | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [search, setSearch] = useState("");
  const [lastCreatedAt, setLastCreatedAt] = useState<number>(0);
  const rowRefs = useMemo(() => new Map<string, HTMLLIElement>(), []);

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
      const { data: emp } = await supabase
        .from("empresas")
        .select("plan_id")
        .eq("id", usuario!.empresa_id)
        .single();
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

  const filtrados = useMemo(() => {
    let list = trabajadores;
    if (filtro !== "todos") list = list.filter((t) => t.estado === filtro);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.nombre ?? "").toLowerCase().includes(s) ||
          t.email.toLowerCase().includes(s) ||
          (t.documento ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [trabajadores, filtro, search]);

  const handleDesactivar = async (id: string) => {
    const { error } = await supabase.from("usuarios").update({ estado: "inactivo" }).eq("id", id);
    if (error) return toast.error("No se pudo desactivar", { description: error.message });
    toast.success("Trabajador desactivado");
    trabajadoresQuery.refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteWorker({ data: { usuario_id: deleteTarget.id } });
      if ("warning" in res && res.warning) {
        toast.warning("Eliminado con aviso", { description: res.warning });
      } else {
        toast.success("Trabajador eliminado");
      }
      setDeleteTarget(null);
      trabajadoresQuery.refetch();
    } catch (err) {
      toast.error("No se pudo eliminar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleResend = async (id: string) => {
    setResending(id);
    try {
      await resendInvite({ data: { usuario_id: id } });
      toast.success("Invitación reenviada");
    } catch (err) {
      toast.error("No se pudo reenviar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setResending(null);
    }
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipo</p>
          <h1 className="text-2xl font-bold tracking-tight">Trabajadores</h1>
          <p className="text-sm text-muted-foreground">
            Da de alta a quienes recibirán las pausas activas.
          </p>
        </header>

        {alerta === "baja_adherencia" && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle>Filtro: baja adherencia</AlertTitle>
            <AlertDescription>
              Mostrando trabajadores con &lt;50% de adherencia en los últimos 7 días.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <div className="space-y-0.5 min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" aria-hidden />
                Cupo del plan
              </CardTitle>
              <CardDescription className="text-xs">
                Activos + pendientes vs. máximo del plan.
              </CardDescription>
            </div>
            <Badge variant={cupoLleno ? "destructive" : "secondary"} className="shrink-0">
              {plan ? `${activos}/${plan.max_trabajadores}` : "…"}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              onClick={() => setOpenAlta(true)}
              disabled={loadingUser || !plan || cupoLleno}
              className="w-full sm:w-auto min-h-11"
            >
              <Plus className="mr-1.5 size-4" aria-hidden />
              Agregar trabajador
            </Button>
            {cupoLleno && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                Plan {plan?.nombre} lleno. Actualiza para sumar más.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription className="text-xs">
                {trabajadoresQuery.isLoading ? "…" : `${filtrados.length}/${trabajadores.length}`}
              </CardDescription>
            </div>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, email o cédula"
                className="pl-9 min-h-11"
                aria-label="Buscar trabajadores"
              />
            </div>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="activo">Activos</TabsTrigger>
                <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
                <TabsTrigger value="inactivo">Inactivos</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {trabajadoresQuery.isLoading && (
              <div className="space-y-3" aria-busy>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            )}

            {trabajadoresQuery.isError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>Error al cargar</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span className="text-xs">{trabajadoresQuery.error.message}</span>
                  <Button size="sm" variant="outline" onClick={() => trabajadoresQuery.refetch()}>
                    Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!trabajadoresQuery.isLoading &&
              !trabajadoresQuery.isError &&
              filtrados.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <UserX className="size-12 text-muted-foreground/40" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {trabajadores.length === 0
                        ? "Aún no hay nadie en tu equipo"
                        : "Aún no hay nada por aquí"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {trabajadores.length === 0
                        ? "Agrega al primero ↑"
                        : "Ajusta filtros o búsqueda."}
                    </p>
                  </div>
                  {trabajadores.length === 0 && (
                    <Button onClick={() => setOpenAlta(true)} disabled={!plan || cupoLleno}>
                      <Plus className="mr-1.5 size-4" aria-hidden />
                      Agregar trabajador
                    </Button>
                  )}
                </div>
              )}

            <ul className="space-y-2">
              {filtrados.map((t) => {
                const isNew =
                  lastCreatedAt > 0 &&
                  new Date(t.created_at).getTime() >= lastCreatedAt;
                return (
                <li
                  key={t.id}
                  ref={(el) => {
                    if (el) rowRefs.set(t.id, el);
                    else rowRefs.delete(t.id);
                  }}
                  className={
                    "rounded-lg border border-border bg-card p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between " +
                    (isNew ? "animate-pulse-green" : "")
                  }
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{t.nombre || "—"}</span>
                      <EstadoBadge estado={t.estado} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                    <p className="text-xs text-muted-foreground">CC {t.documento || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 sm:shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditTarget(t)}
                      aria-label={`Editar ${t.nombre || t.email}`}
                      className="min-touch"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    {t.estado === "pendiente" && !t.password_set && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResend(t.id)}
                        disabled={resending === t.id}
                        aria-label="Reenviar invitación"
                        className="min-touch"
                      >
                        <Mail className="size-4" aria-hidden />
                      </Button>
                    )}
                    {t.estado !== "inactivo" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDesactivar(t.id)}
                        className="min-h-11"
                      >
                        Desactivar
                      </Button>
                    )}
                    {t.estado === "inactivo" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(t)}
                        aria-label={`Eliminar ${t.nombre || t.email}`}
                        className="min-touch text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>

      <AltaTrabajadorDialog
        open={openAlta}
        onOpenChange={setOpenAlta}
        empresaId={usuario?.empresa_id}
        onSuccess={async () => {
          const ts = Date.now() - 5000;
          setLastCreatedAt(ts);
          await trabajadoresQuery.refetch();
          setTimeout(() => {
            const newest = trabajadoresQuery.data?.find(
              (t) => new Date(t.created_at).getTime() >= ts,
            );
            if (newest) {
              const el = rowRefs.get(newest.id);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            // limpia el highlight tras 3s
            setTimeout(() => setLastCreatedAt(0), 3000);
          }, 100);
        }}
      />
      <EditTrabajadorDialog
        trabajador={editTarget}
        onOpenChange={(o: boolean) => !o && setEditTarget(null)}
        onSuccess={() => trabajadoresQuery.refetch()}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar trabajador?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar permanentemente a{" "}
              <strong>{deleteTarget?.nombre || deleteTarget?.email}</strong>.
              Esta acción no se puede deshacer y borra su cuenta de acceso.
              El historial de pausas ya registrado se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
