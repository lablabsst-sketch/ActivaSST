import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import type { Database } from "@/integrations/supabase/types";

type TipoTrabajo = Database["public"]["Tables"]["tipos_trabajo"]["Row"];

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Completa tu perfil — Activa SST" }],
  }),
  component: OnboardingPage,
});

const schema = z.object({
  nombre: z.string().min(2),
  apellidos: z.string().min(2),
  tipoIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un tipo de trabajo"),
  consentimiento: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el tratamiento de datos para continuar" }),
  }),
});
type Values = z.infer<typeof schema>;

const CONSENT_VERSION = "v1-2026-06";
const FINALIDADES = [
  "gestion_pausas_activas",
  "cumplimiento_sg_sst",
  "reportes_adherencia",
  "comunicaciones_operativas",
  "auditoria_legal",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { session, usuario, loading } = useUsuario();
  const [submitting, setSubmitting] = useState(false);

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { tipoIds: [] },
  });

  // Pre-rellenar nombre/apellidos si ya existen.
  useEffect(() => {
    if (!usuario) return;
    if (usuario.nombre) {
      const parts = usuario.nombre.split(" ");
      reset({
        nombre: parts[0] ?? "",
        apellidos: parts.slice(1).join(" "),
        tipoIds: [],
        consentimiento: undefined as unknown as true,
      });
    }
  }, [usuario, reset]);

  // Redirecciones según estado.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (usuario && usuario.estado === "activo") {
      navigate({
        to: usuario.rol === "trabajador" ? "/trabajador" : "/prevencionista",
      });
    }
    if (usuario && usuario.estado === "inactivo") {
      toast.error("Tu cuenta fue desactivada por el administrador. Contacta a tu prevencionista.");
      supabase.auth.signOut().then(() => navigate({ to: "/login" }));
    }
  }, [usuario, session, loading, navigate]);

  const selectedTipos = watch("tipoIds");

  const toggleTipo = (id: string, checked: boolean) => {
    setValue(
      "tipoIds",
      checked ? [...selectedTipos, id] : selectedTipos.filter((t) => t !== id),
      { shouldValidate: true },
    );
  };

  const onSubmit = async (values: Values) => {
    if (!usuario) return;
    setSubmitting(true);
    try {
      // 1) Actualiza nombre + estado=activo.
      const { error: updErr } = await supabase
        .from("usuarios")
        .update({
          nombre: `${values.nombre} ${values.apellidos}`.trim(),
          estado: "activo",
        })
        .eq("id", usuario.id);
      if (updErr) throw updErr;

      // 2) Sincroniza usuario_tipos_trabajo: limpia y vuelve a insertar.
      const { error: delErr } = await supabase
        .from("usuario_tipos_trabajo")
        .delete()
        .eq("usuario_id", usuario.id);
      if (delErr) throw delErr;
      if (values.tipoIds.length) {
        const rows = values.tipoIds.map((tipo_id) => ({ usuario_id: usuario.id, tipo_id }));
        const { error: insErr } = await supabase.from("usuario_tipos_trabajo").insert(rows);
        if (insErr) throw insErr;
      }

      // 3) Registra consentimiento Habeas Data (Ley 1581/2012).
      const { error: consErr } = await supabase.from("consentimientos").insert({
        usuario_id: usuario.id,
        version_aviso: CONSENT_VERSION,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (consErr) throw consErr;

      toast.success("¡Listo! Tu cuenta quedó activa.");
      navigate({
        to: usuario.rol === "trabajador" ? "/trabajador" : "/prevencionista",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error("No pudimos completar tu registro", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !usuario) {
    return (
      <AppShell>
        <p className="pt-8 text-center text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bienvenido</p>
          <h1 className="text-2xl font-bold tracking-tight">Completa tu perfil</h1>
          <p className="text-sm text-muted-foreground">
            Solo te llevará un minuto. Necesitamos confirmar tus datos para enviarte las pausas
            activas correctas.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
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
            <Label>Tipo de trabajo</Label>
            <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
              {(tiposQuery.data ?? []).map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedTipos.includes(t.id)}
                    onCheckedChange={(c) => toggleTipo(t.id, c === true)}
                  />
                  {t.nombre}
                </label>
              ))}
            </div>
            {errors.tipoIds && (
              <p className="text-xs text-destructive">{errors.tipoIds.message}</p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tratamiento de datos personales</CardTitle>
              <CardDescription className="text-xs">
                En cumplimiento de la Ley 1581 de 2012 (Habeas Data).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Activa SST recolectará tu nombre, correo, cédula, tipo de trabajo y las respuestas
                que des a las pausas activas, con el único fin de gestionar el cumplimiento de tu
                programa SG-SST. Puedes revocar este consentimiento en cualquier momento desde tu
                perfil.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={watch("consentimiento") === true}
                  onCheckedChange={(c) =>
                    setValue("consentimiento", c === true ? true : (false as unknown as true), {
                      shouldValidate: true,
                    })
                  }
                />
                <span>Acepto el tratamiento de mis datos según los términos anteriores.</span>
              </label>
              {errors.consentimiento && (
                <p className="text-xs text-destructive">{errors.consentimiento.message}</p>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Guardando…" : "Activar mi cuenta"}
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
