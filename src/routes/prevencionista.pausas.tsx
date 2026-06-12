import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Trash2, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import type { Database } from "@/integrations/supabase/types";

type Pausa = Database["public"]["Tables"]["pausas_oficiales"]["Row"];
type PackEnum = Database["public"]["Enums"]["pausa_oficial_pack"];

export const Route = createFileRoute("/prevencionista/pausas")({
  head: () => ({ meta: [{ title: "Pausas — Activa SST" }] }),
  component: PausasPage,
});

function PausasPage() {
  const { usuario } = useUsuario();
  const empresaId = usuario?.empresa_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const pausasQ = useQuery({
    queryKey: ["pausas-todas", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Pausa[]> => {
      const { data, error } = await supabase
        .from("pausas_oficiales")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ocultasQ = useQuery({
    queryKey: ["pausas-ocultas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pausas_oficiales_ocultas")
        .select("pausa_oficial_id")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return new Set((data ?? []).map((o) => o.pausa_oficial_id));
    },
  });

  const toggleHidden = async (pausa: Pausa) => {
    if (!empresaId) return;
    const oculta = ocultasQ.data?.has(pausa.id);
    if (oculta) {
      const { error } = await supabase
        .from("pausas_oficiales_ocultas")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("pausa_oficial_id", pausa.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("pausas_oficiales_ocultas").insert({
        empresa_id: empresaId,
        pausa_oficial_id: pausa.id,
      });
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["pausas-ocultas"] });
  };

  const removeCustom = async (p: Pausa) => {
    if (!confirm(`¿Borrar "${p.titulo}"?`)) return;
    const { error } = await supabase.from("pausas_oficiales").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Borrada");
      qc.invalidateQueries({ queryKey: ["pausas-todas"] });
    }
  };

  const base = (pausasQ.data ?? []).filter((p) => p.empresa_id === null);
  const custom = (pausasQ.data ?? []).filter((p) => p.empresa_id === empresaId);

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-2">
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Catálogo</p>
            <h1 className="text-2xl font-bold tracking-tight">Pausas</h1>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nueva custom
          </Button>
        </header>

        <h2 className="text-sm font-semibold mt-2">Catálogo base</h2>
        <ul className="flex flex-col gap-2">
          {base.map((p) => {
            const oculta = ocultasQ.data?.has(p.id) ?? false;
            return (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {p.instrucciones}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.codigo} · {p.duracion_min} min
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleHidden(p)}
                      aria-label={oculta ? "Mostrar" : "Ocultar"}
                    >
                      {oculta ? (
                        <EyeOff className="size-4 text-destructive" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>

        <h2 className="text-sm font-semibold mt-4">Custom de tu empresa</h2>
        {custom.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no has creado pausas propias.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {custom.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{p.titulo}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          Custom
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {p.instrucciones}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.codigo} · {p.duracion_min} min
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCustom(p)}
                      aria-label="Borrar"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <NuevaCustomDialog
          open={open}
          onOpenChange={setOpen}
          empresaId={empresaId}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["pausas-todas"] });
            setOpen(false);
          }}
        />
      </section>
    </AppShell>
  );
}

const customSchema = z.object({
  titulo: z.string().min(3).max(100),
  duracion_min: z.coerce.number().int().min(1).max(60),
  instrucciones: z.string().min(10).max(200, "Máximo 200 caracteres"),
  video_url: z
    .string()
    .url("URL inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
type CustomVals = z.infer<typeof customSchema>;

function NuevaCustomDialog({
  open,
  onOpenChange,
  empresaId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | undefined;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomVals>({
    resolver: zodResolver(customSchema),
    defaultValues: { duracion_min: 3 },
  });

  const onSubmit = async (v: CustomVals) => {
    if (!empresaId) return;
    setSubmitting(true);
    try {
      const codigo = `C-${empresaId.slice(0, 4)}-${Date.now().toString(36).slice(-4)}`;
      const { error } = await supabase.from("pausas_oficiales").insert({
        empresa_id: empresaId,
        codigo,
        titulo: v.titulo,
        duracion_min: v.duracion_min,
        instrucciones: v.instrucciones,
        video_url: v.video_url ?? null,
        pack: "universal" as PackEnum, // pack base para customs (RLS no filtra por pack)
      });
      if (error) throw error;
      toast.success("Pausa custom creada");
      reset();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva pausa custom</DialogTitle>
          <DialogDescription>Pausa exclusiva de tu empresa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" {...register("titulo")} />
            {errors.titulo && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duracion_min">Duración (min)</Label>
            <Input
              id="duracion_min"
              type="number"
              min={1}
              max={60}
              {...register("duracion_min")}
            />
            {errors.duracion_min && (
              <p className="text-xs text-destructive">{errors.duracion_min.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instrucciones">Instrucciones (máx 200)</Label>
            <Textarea id="instrucciones" rows={4} {...register("instrucciones")} />
            {errors.instrucciones && (
              <p className="text-xs text-destructive">{errors.instrucciones.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video_url">Video URL (opcional)</Label>
            <Input id="video_url" {...register("video_url")} placeholder="https://…" />
            {errors.video_url && (
              <p className="text-xs text-destructive">{errors.video_url.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
