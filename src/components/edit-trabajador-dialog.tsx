import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { updateWorker } from "@/lib/api/workers.functions";
import type { Database } from "@/integrations/supabase/types";

type Trabajador = Database["public"]["Tables"]["usuarios"]["Row"];
type TipoTrabajo = Database["public"]["Tables"]["tipos_trabajo"]["Row"];

const schema = z.object({
  nombre: z.string().min(1, "Requerido").max(120),
  tipo_ids: z.array(z.string().uuid()),
});

type FormVals = z.infer<typeof schema>;

interface Props {
  trabajador: Trabajador | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTrabajadorDialog({ trabajador, onOpenChange, onSuccess }: Props) {
  const open = !!trabajador;
  const [submitting, setSubmitting] = useState(false);

  const tiposQuery = useQuery({
    queryKey: ["tipos-trabajo"],
    queryFn: async (): Promise<TipoTrabajo[]> => {
      const { data, error } = await supabase.from("tipos_trabajo").select("*").order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const actualesQuery = useQuery({
    queryKey: ["usuario-tipos", trabajador?.id],
    enabled: !!trabajador?.id,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("usuario_tipos_trabajo")
        .select("tipo_id")
        .eq("usuario_id", trabajador!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.tipo_id);
    },
  });

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", tipo_ids: [] },
  });

  useEffect(() => {
    if (trabajador && actualesQuery.data) {
      form.reset({
        nombre: trabajador.nombre ?? "",
        tipo_ids: actualesQuery.data,
      });
    }
  }, [trabajador, actualesQuery.data, form]);

  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data]);

  const onSubmit = async (values: FormVals) => {
    if (!trabajador) return;
    setSubmitting(true);
    try {
      await updateWorker({
        data: {
          usuario_id: trabajador.id,
          nombre: values.nombre,
          tipo_ids: values.tipo_ids,
        },
      });
      toast.success("Trabajador actualizado");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("No se pudo actualizar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar trabajador</DialogTitle>
          <DialogDescription>
            Email y cédula son de solo lectura por compliance.
          </DialogDescription>
        </DialogHeader>
        {trabajador && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={trabajador.email} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Cédula</Label>
              <Input value={trabajador.documento ?? ""} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input id="edit-nombre" {...form.register("nombre")} />
              {form.formState.errors.nombre && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.nombre.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipos de trabajo</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
                {tipos.map((t) => {
                  const checked = form.watch("tipo_ids").includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-sm cursor-pointer min-h-9"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          const cur = form.getValues("tipo_ids");
                          form.setValue(
                            "tipo_ids",
                            c ? [...cur, t.id] : cur.filter((id) => id !== t.id),
                          );
                        }}
                        aria-label={t.nombre}
                      />
                      {t.nombre}
                    </label>
                  );
                })}
                {tipos.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin tipos disponibles.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
