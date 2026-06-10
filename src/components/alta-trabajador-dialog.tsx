import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { importWorkers } from "@/lib/api/workers.functions";
import type { Database } from "@/integrations/supabase/types";

type TipoTrabajo = Database["public"]["Tables"]["tipos_trabajo"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string | undefined;
  onSuccess: () => void;
}

export function AltaTrabajadorDialog({ open, onOpenChange, empresaId, onSuccess }: Props) {
  const tiposQuery = useQuery({
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar trabajador</DialogTitle>
          <DialogDescription>
            Solo los correos que registres aquí podrán iniciar sesión. Elige el modo que mejor se
            adapte.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="individual">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="mini">Mini-pegado</TabsTrigger>
            <TabsTrigger value="csv">CSV</TabsTrigger>
          </TabsList>
          <TabsContent value="individual" className="mt-4">
            <FormIndividual
              empresaId={empresaId}
              tipos={tiposQuery.data ?? []}
              onDone={() => {
                onSuccess();
                onOpenChange(false);
              }}
            />
          </TabsContent>
          <TabsContent value="mini" className="mt-4">
            <FormMini
              empresaId={empresaId}
              onDone={() => {
                onSuccess();
                onOpenChange(false);
              }}
            />
          </TabsContent>
          <TabsContent value="csv" className="mt-4">
            <p className="text-sm text-muted-foreground">
              Subida de CSV completa pendiente (T072). Por ahora usa mini-pegado o individual.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modo individual
// ============================================================

const individualSchema = z.object({
  documento: z.string().min(5, "Cédula muy corta").max(20),
  nombre: z.string().min(2),
  apellidos: z.string().min(2),
  email: z.string().email("Correo no válido"),
  tipoIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un tipo de trabajo"),
});
type IndividualValues = z.infer<typeof individualSchema>;

function FormIndividual({
  empresaId,
  tipos,
  onDone,
}: {
  empresaId: string | undefined;
  tipos: TipoTrabajo[];
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<IndividualValues>({
    resolver: zodResolver(individualSchema),
    defaultValues: { tipoIds: [] },
  });

  const selectedTipos = watch("tipoIds");

  const toggleTipo = (id: string, checked: boolean) => {
    setValue(
      "tipoIds",
      checked ? [...selectedTipos, id] : selectedTipos.filter((t) => t !== id),
      { shouldValidate: true },
    );
  };

  const onSubmit = async (values: IndividualValues) => {
    if (!empresaId) {
      toast.error("Sin empresa asignada");
      return;
    }
    setSubmitting(true);
    try {
      const result = await importWorkers({
        data: {
          empresa_id: empresaId,
          modo: "individual",
          trabajador: {
            documento: values.documento,
            nombre: `${values.nombre} ${values.apellidos}`.trim(),
            email: values.email,
            tipo_ids: values.tipoIds,
            estado: "pendiente",
          },
        },
      });
      const detalle = result.detalles[0];
      if (detalle?.resultado === "creado") {
        toast.success("Trabajador creado y magic link enviado");
      } else {
        toast.error(detalle?.motivo ?? "No se pudo crear");
        return;
      }
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error("No se pudo crear", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="documento">Cédula</Label>
          <Input id="documento" {...register("documento")} />
          {errors.documento && (
            <p className="text-xs text-destructive">{errors.documento.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" inputMode="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register("nombre")} />
          {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input id="apellidos" {...register("apellidos")} />
          {errors.apellidos && (
            <p className="text-xs text-destructive">{errors.apellidos.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Tipos de trabajo</Label>
        <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
          {tipos.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedTipos.includes(t.id)}
                onCheckedChange={(c) => toggleTipo(t.id, c === true)}
              />
              {t.nombre}
            </label>
          ))}
        </div>
        {errors.tipoIds && <p className="text-xs text-destructive">{errors.tipoIds.message}</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Creando…" : "Crear y enviar invitación"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================================
// Modo mini-pegado (cédula,correo por línea)
// ============================================================

function FormMini({
  empresaId,
  onDone,
}: {
  empresaId: string | undefined;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseMiniPegado(text);

  const onSubmit = async () => {
    if (!empresaId) {
      toast.error("Sin empresa asignada");
      return;
    }
    if (parsed.valid.length === 0) {
      toast.error("No hay filas válidas para procesar");
      return;
    }
    setSubmitting(true);
    try {
      const result = await importWorkers({
        data: {
          empresa_id: empresaId,
          modo: "mini",
          trabajadores: parsed.valid.map((r) => ({
            documento: r.documento,
            email: r.email,
            estado: "pendiente" as const,
          })),
        },
      });
      toast.success(
        `Procesados: ${result.creados} creados, ${result.omitidos} omitidos${
          result.bloqueados_por_cupo ? `, ${result.bloqueados_por_cupo} bloqueados por cupo` : ""
        }`,
      );
      setText("");
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error("Falló el procesamiento", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="bulk">Pega una fila por línea con formato cédula,correo</Label>
        <Textarea
          id="bulk"
          rows={8}
          placeholder={"1020304050,juan@empresa.co\n1234567890,maria@empresa.co"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
      <div className="rounded-md border bg-muted/30 p-2 text-xs">
        <p>Válidas: {parsed.valid.length}</p>
        {parsed.invalid.length > 0 && (
          <p className="text-destructive">
            Inválidas: {parsed.invalid.length} (líneas: {parsed.invalid.map((i) => i.line).join(", ")})
          </p>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={onSubmit}
          disabled={submitting || parsed.valid.length === 0}
          className="w-full sm:w-auto"
        >
          {submitting ? "Procesando…" : `Crear ${parsed.valid.length} y enviar invitaciones`}
        </Button>
      </DialogFooter>
    </div>
  );
}

function parseMiniPegado(text: string) {
  const valid: { documento: string; email: string }[] = [];
  const invalid: { line: number; raw: string }[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,;\t]/).map((s) => s.trim());
    if (parts.length < 2) {
      invalid.push({ line, raw: trimmed });
      return;
    }
    const [documento, email] = parts;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const validDoc = /^\d{5,20}$/.test(documento);
    if (!validEmail || !validDoc) {
      invalid.push({ line, raw: trimmed });
      return;
    }
    valid.push({ documento, email });
  });
  return { valid, invalid };
}
