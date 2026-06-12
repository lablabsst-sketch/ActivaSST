import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { DIAS_LABEL, diasList, fmtHora } from "@/lib/dias-horas";
import type { Database } from "@/integrations/supabase/types";

type Programacion = Database["public"]["Tables"]["programaciones"]["Row"];
type PausaOficial = Database["public"]["Tables"]["pausas_oficiales"]["Row"];
type TipoTrabajo = Database["public"]["Tables"]["tipos_trabajo"]["Row"];

export const Route = createFileRoute("/prevencionista/programaciones")({
  head: () => ({ meta: [{ title: "Programaciones — Activa SST" }] }),
  component: ProgramacionesPage,
});

function ProgramacionesPage() {
  const { usuario } = useUsuario();
  const empresaId = usuario?.empresa_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programacion | null>(null);

  const progsQ = useQuery({
    queryKey: ["programaciones", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Programacion[]> => {
      const { data, error } = await supabase
        .from("programaciones")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pausasQ = useQuery({
    queryKey: ["pausas-oficiales-visibles", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<PausaOficial[]> => {
      const { data: ocultas } = await supabase
        .from("pausas_oficiales_ocultas")
        .select("pausa_oficial_id")
        .eq("empresa_id", empresaId!);
      const hidden = new Set((ocultas ?? []).map((o) => o.pausa_oficial_id));
      const { data, error } = await supabase
        .from("pausas_oficiales")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return (data ?? []).filter((p) => !hidden.has(p.id));
    },
  });

  const tiposQ = useQuery({
    queryKey: ["tipos-trabajo"],
    queryFn: async (): Promise<TipoTrabajo[]> => {
      const { data, error } = await supabase
        .from("tipos_trabajo")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleActiva = async (p: Programacion) => {
    const { error } = await supabase
      .from("programaciones")
      .update({ activa: !p.activa })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["programaciones"] });
  };

  const remove = async (p: Programacion) => {
    if (!confirm(`¿Borrar "${p.nombre}"?`)) return;
    const { error } = await supabase.from("programaciones").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Borrada");
      qc.invalidateQueries({ queryKey: ["programaciones"] });
    }
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-2">
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Programa</p>
            <h1 className="text-2xl font-bold tracking-tight">Programaciones</h1>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Nueva
          </Button>
        </header>

        {progsQ.isLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <div className="h-20 w-full rounded-lg bg-muted animate-pulse" />
            <div className="h-20 w-full rounded-lg bg-muted animate-pulse" />
          </div>
        ) : progsQ.error ? (
          <Card>
            <CardContent role="alert" className="pt-6 text-sm text-destructive">
              No se pudieron cargar las programaciones. Recarga la página.
            </CardContent>
          </Card>
        ) : (progsQ.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground text-center">
              Aún no has creado programaciones. Toca "Nueva" para empezar.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {progsQ.data!.map((p) => {
              const pausa = pausasQ.data?.find((x) => x.id === p.pausa_oficial_id);
              return (
                <li key={p.id}>
                  <Card>
                    <CardContent className="flex items-start justify-between gap-2 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{p.nombre}</p>
                          {p.activa ? (
                            <Badge variant="default" className="text-[10px]">
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Pausada
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {pausa?.titulo ?? "Pausa eliminada"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {diasList(p.dias_semana)} · {p.horas.map(fmtHora).join(" ")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Switch
                          checked={p.activa}
                          onCheckedChange={() => toggleActiva(p)}
                          aria-label="Activa"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(p);
                              setOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(p)}
                            aria-label="Borrar"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <ProgramacionDialog
          open={open}
          onOpenChange={setOpen}
          empresaId={empresaId}
          usuarioId={usuario?.id}
          pausas={pausasQ.data ?? []}
          tipos={tiposQ.data ?? []}
          editing={editing}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["programaciones"] });
            setOpen(false);
          }}
        />
      </section>
    </AppShell>
  );
}

// ============================================================
// Dialog crear/editar
// ============================================================

const schema = z.object({
  nombre: z.string().min(2),
  pausa_oficial_id: z.string().uuid(),
  dias_semana: z.array(z.number().int().min(0).max(6)).min(1, "Selecciona al menos un día"),
  horas: z.array(z.string().regex(/^\d{1,2}:\d{2}$/)).min(1, "Agrega al menos una hora"),
  tipos_trabajo_objetivo: z.array(z.string().uuid()),
  activa: z.boolean(),
});
type Values = z.infer<typeof schema>;

function ProgramacionDialog({
  open,
  onOpenChange,
  empresaId,
  usuarioId,
  pausas,
  tipos,
  editing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | undefined;
  usuarioId: string | undefined;
  pausas: PausaOficial[];
  tipos: TipoTrabajo[];
  editing: Programacion | null;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const defaults: Values = editing
    ? {
        nombre: editing.nombre,
        pausa_oficial_id: editing.pausa_oficial_id,
        dias_semana: editing.dias_semana ?? [1, 2, 3, 4, 5],
        horas: (editing.horas ?? []).map((h) => h.slice(0, 5)),
        tipos_trabajo_objetivo: editing.tipos_trabajo_objetivo ?? [],
        activa: editing.activa,
      }
    : {
        nombre: "",
        pausa_oficial_id: pausas[0]?.id ?? "",
        dias_semana: [1, 2, 3, 4, 5],
        horas: ["10:30", "12:30", "14:30", "16:30"],
        tipos_trabajo_objetivo: [],
        activa: true,
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  // Reset cuando cambia "editing"
  useState(() => reset(defaults));

  const dias = watch("dias_semana") ?? [];
  const horas = watch("horas") ?? [];
  const tiposSel = watch("tipos_trabajo_objetivo") ?? [];
  const pausaId = watch("pausa_oficial_id");

  const toggleDia = (d: number, checked: boolean) =>
    setValue("dias_semana", checked ? [...dias, d] : dias.filter((x) => x !== d), {
      shouldValidate: true,
    });
  const toggleTipo = (id: string, checked: boolean) =>
    setValue(
      "tipos_trabajo_objetivo",
      checked ? [...tiposSel, id] : tiposSel.filter((x) => x !== id),
      { shouldValidate: true },
    );
  const setHoraAt = (i: number, val: string) => {
    const copy = horas.slice();
    copy[i] = val;
    setValue("horas", copy, { shouldValidate: true });
  };
  const addHora = () => setValue("horas", [...horas, "12:00"], { shouldValidate: true });
  const removeHora = (i: number) =>
    setValue(
      "horas",
      horas.filter((_, idx) => idx !== i),
      { shouldValidate: true },
    );

  const onSubmit = async (v: Values) => {
    if (!empresaId || !usuarioId) return;
    setSubmitting(true);
    try {
      const payload = {
        empresa_id: empresaId,
        creador_id: usuarioId,
        nombre: v.nombre,
        pausa_oficial_id: v.pausa_oficial_id,
        dias_semana: v.dias_semana,
        horas: v.horas.map((h) => `${h}:00`),
        tipos_trabajo_objetivo: v.tipos_trabajo_objetivo,
        activa: v.activa,
      };
      const { error } = editing
        ? await supabase.from("programaciones").update(payload).eq("id", editing.id)
        : await supabase.from("programaciones").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Programación actualizada" : "Programación creada");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset(defaults);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Nueva"} programación</DialogTitle>
          <DialogDescription>
            Define cuándo se dispara una pausa y a quiénes aplica.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} placeholder="Ej: Pausa mañana operativos" />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pausa">Pausa</Label>
            <select
              id="pausa"
              value={pausaId}
              onChange={(e) =>
                setValue("pausa_oficial_id", e.target.value, { shouldValidate: true })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Selecciona —</option>
              {pausas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo} ({p.duracion_min} min)
                </option>
              ))}
            </select>
            {errors.pausa_oficial_id && (
              <p className="text-xs text-destructive">Selecciona una pausa</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Días</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DIAS_LABEL).map(([k, label]) => {
                const d = Number(k);
                const checked = dias.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDia(d, !checked)}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      checked
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {errors.dias_semana && (
              <p className="text-xs text-destructive">{errors.dias_semana.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Horas</Label>
            <div className="flex flex-col gap-2">
              {horas.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={h}
                    onChange={(e) => setHoraAt(i, e.target.value)}
                    className="max-w-[140px]"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeHora(i)}
                    aria-label="Quitar"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addHora}>
                <Plus className="size-3" /> Agregar hora
              </Button>
            </div>
            {errors.horas && <p className="text-xs text-destructive">{errors.horas.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Tipos de trabajo objetivo</Label>
            <p className="text-xs text-muted-foreground">
              Vacío = aplica a todos los trabajadores.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {tipos.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={tiposSel.includes(t.id)}
                    onCheckedChange={(c) => toggleTipo(t.id, c === true)}
                  />
                  {t.nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="activa">Activa</Label>
            <Switch
              id="activa"
              checked={watch("activa")}
              onCheckedChange={(c) => setValue("activa", c)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
