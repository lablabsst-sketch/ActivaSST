import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import type { Database } from "@/integrations/supabase/types";

type TipoTrabajo = Database["public"]["Tables"]["tipos_trabajo"]["Row"];

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Completa tu perfil — Activa SST" }] }),
  component: OnboardingPage,
});

const schema = z.object({
  nombre: z.string().min(2, "Mínimo 2 caracteres"),
  apellidos: z.string().min(2, "Mínimo 2 caracteres"),
  tipoIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un tipo"),
  consentimiento: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar para continuar" }),
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

const STEPS = ["Datos", "Tipos de trabajo", "Consentimiento"];

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Más información"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { session, usuario, loading } = useUsuario();
  const [step, setStep] = useState(0);
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
    trigger,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { tipoIds: [] },
    mode: "onChange",
  });

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
      toast.error("Cuenta desactivada", {
        description: "Contacta a tu prevencionista para reactivarla.",
      });
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

  const handleNext = async () => {
    let ok = false;
    if (step === 0) ok = await trigger(["nombre", "apellidos"]);
    else if (step === 1) ok = await trigger(["tipoIds"]);
    else if (step === 2) ok = await trigger(["consentimiento"]);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = async (values: Values) => {
    if (!usuario) return;

    setSubmitting(true);
    try {
      const { error: updErr } = await supabase
        .from("usuarios")
        .update({
          nombre: `${values.nombre} ${values.apellidos}`.trim(),
          estado: "activo",
        })
        .eq("id", usuario.id);
      if (updErr) throw updErr;

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

      const { error: consErr } = await supabase.from("consentimientos").insert({
        usuario_id: usuario.id,
        version_aviso: CONSENT_VERSION,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        finalidades_aceptadas: FINALIDADES,
      });
      if (consErr) throw consErr;

      toast.success("¡Cuenta activada!", { description: "Bienvenido a Activa SST." });
      navigate({
        to: usuario.rol === "trabajador" ? "/trabajador" : "/prevencionista",
      });
    } catch (err) {
      toast.error("Algo no salió bien", {
        description: err instanceof Error ? err.message : "Reintenta o contacta soporte.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !usuario) {
    return (
      <AppShell>
        <p className="pt-8 text-center text-sm text-muted-foreground">Un momento…</p>
      </AppShell>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const isLast = step === STEPS.length - 1;

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Paso {step + 1} de {STEPS.length}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{STEPS[step]}</h1>
          <Progress value={progress} aria-label={`Progreso: ${Math.round(progress)}%`} />
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tus datos</CardTitle>
                <CardDescription className="text-xs">
                  Para personalizar los mensajes que verás.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre" className="flex items-center gap-1.5">
                    Nombre
                    <InfoTip text="Tu nombre aparecerá en los saludos y reportes personales." />
                  </Label>
                  <Input id="nombre" {...register("nombre")} autoFocus />
                  {errors.nombre && (
                    <p className="text-xs text-destructive">{errors.nombre.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apellidos" className="flex items-center gap-1.5">
                    Apellidos
                    <InfoTip text="Se usa para identificarte en tu certificado de adherencia." />
                  </Label>
                  <Input id="apellidos" {...register("apellidos")} />
                  {errors.apellidos && (
                    <p className="text-xs text-destructive">{errors.apellidos.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5">
                  Tipos de trabajo
                  <InfoTip text="Define qué pausas activas son las indicadas para tu actividad. Puedes elegir más de una." />
                </CardTitle>
                <CardDescription className="text-xs">
                  Las pausas se ajustan a la postura y movimiento de tu jornada.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  <p className="mt-2 text-xs text-destructive">{errors.tipoIds.message}</p>
                )}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5">
                  Tratamiento de datos
                  <InfoTip text="Ley 1581 de 2012 (Habeas Data). Necesitamos tu consentimiento para tratar datos de salud ocupacional." />
                </CardTitle>
                <CardDescription className="text-xs">
                  En cumplimiento de la Ley 1581 de 2012.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Activa SST trata datos de identificación, laborales y{" "}
                  <strong>sensibles de salud ocupacional</strong> (registro de pausas activas)
                  para cumplir la Resolución 0312/2019 SST. Lee la{" "}
                  <a
                    href="/politica-tratamiento-datos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Política de Tratamiento de Datos
                  </a>{" "}
                  completa.
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
                  <span>
                    He leído y acepto la Política de Tratamiento de Datos Personales conforme a
                    la Ley 1581 de 2012, autorizando el tratamiento de mis datos personales y
                    sensibles (salud ocupacional) para las finalidades allí descritas.
                  </span>
                </label>
                {errors.consentimiento && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.consentimiento.message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                className="flex-1"
              >
                <ArrowLeft className="size-4" /> Atrás
              </Button>
            )}
            {!isLast && (
              <Button type="button" onClick={handleNext} className="flex-1">
                Continuar <ArrowRight className="size-4" />
              </Button>
            )}
            {isLast && (
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Activando…" : "Activar mi cuenta"}
              </Button>
            )}
          </div>
        </form>
      </section>
    </AppShell>
  );
}
