import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { PauseSuccessOverlay } from "@/components/pause-success-overlay";
import { StateLoading } from "@/components/states";

export const Route = createFileRoute("/trabajador/pausa/$id")({
  head: () => ({ meta: [{ title: "Pausa — Activa SST" }] }),
  component: PausaPage,
});

function PausaPage() {
  const { id: programacionId } = Route.useParams();
  const navigate = useNavigate();
  const { usuario, loading: usuarioLoading } = useUsuario();
  const qc = useQueryClient();
  const [confirmExit, setConfirmExit] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const progQ = useQuery({
    queryKey: ["prog-detalle", programacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programaciones")
        .select(
          "id, nombre, pausa_oficial_id, pausas_oficiales(id, codigo, titulo, duracion_min, instrucciones, video_url)",
        )
        .eq("id", programacionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const pausa = progQ.data?.pausas_oficiales as
    | {
        id: string;
        codigo: string;
        titulo: string;
        duracion_min: number;
        instrucciones: string;
        video_url: string | null;
      }
    | null
    | undefined;
  const durMin = pausa?.duracion_min ?? 3;
  const ilustracionUrl = pausa?.codigo ? `/pausas/${pausa.codigo.toLowerCase()}.svg` : null;

  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAtPauseRef = useRef(0);
  const vibratedRef = useRef(false);

  useEffect(() => {
    if (secsLeft === null && pausa) {
      setSecsLeft(durMin * 60);
    }
  }, [pausa, durMin, secsLeft]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecsLeft((s) => {
        if (s === null) return s;
        if (s <= 1) {
          clearInterval(id);
          setRunning(false);
          if (!vibratedRef.current) {
            vibratedRef.current = true;
            try {
              navigator.vibrate?.([200, 80, 200]);
            } catch {
              // noop
            }
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    setRunning(true);
  };
  const pause = () => {
    if (startedAtRef.current) {
      elapsedAtPauseRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    startedAtRef.current = null;
    elapsedAtPauseRef.current = 0;
    setSecsLeft(durMin * 60);
    vibratedRef.current = false;
  };

  const elapsedSec = () => {
    let ms = elapsedAtPauseRef.current;
    if (startedAtRef.current) ms += Date.now() - startedAtRef.current;
    return Math.max(0, Math.round(ms / 1000));
  };

  const registrar = async (estado: "hecha" | "postpuesta") => {
    // El perfil aún puede estar cargando: avisamos en vez de fallar en silencio.
    if (usuarioLoading || progQ.isLoading) {
      toast.info("Un momento", { description: "Aún estamos cargando tu pausa" });
      return;
    }
    if (!usuario?.id || !pausa?.id) {
      toast.error("No pudimos identificar la pausa", {
        description: "Vuelve a tu inicio e intenta de nuevo",
      });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("pausa_registros").insert({
        trabajador_id: usuario.id,
        programacion_id: programacionId,
        pausa_oficial_id: pausa.id,
        estado,
        duracion_real_seg: estado === "hecha" ? elapsedSec() : null,
        respondido_en: new Date().toISOString(),
        response_uuid: crypto.randomUUID(),
      });
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["registros-hoy"] }),
        qc.invalidateQueries({ queryKey: ["historial"] }),
        qc.invalidateQueries({ queryKey: ["reportes-periodo"] }),
      ]);
      if (estado === "hecha") {
        setShowSuccess(true);
      } else {
        toast.success("Te recordaremos pronto", {
          description: "Marcamos esta pausa como postpuesta",
        });
        navigate({ to: "/trabajador" });
      }
    } catch (err) {
      // Postgres devuelve 42501 cuando el INSERT no pasa el WITH CHECK de RLS.
      // Diagnosticamos qué condición exactamente falló para dar feedback claro.
      const raw = err as { code?: string; message?: string };
      const code = raw?.code;
      const message = err instanceof Error ? err.message : (raw?.message ?? "");
      const isRls =
        code === "42501" || /row-level security|violates row-level security/i.test(message);

      if (isRls) {
        try {
          const { data: diag, error: diagErr } = await supabase.rpc(
            "diagnose_pausa_registro_insert",
            { p_programacion_id: programacionId },
          );
          if (diagErr) throw diagErr;
          const row = Array.isArray(diag) ? diag[0] : diag;
          const diagMsg =
            (row as { message?: string } | null)?.message ?? "No se pudo identificar el motivo";
          const diagCode = (row as { code?: string } | null)?.code ?? "rls_denied";
          console.warn("[pausa-registro] RLS denegó el INSERT", {
            diagCode,
            diagMsg,
            rawMessage: message,
          });
          toast.error("No podemos registrar esta pausa", {
            description: `${diagMsg} (${diagCode})`,
          });
        } catch (diagCallErr) {
          console.error("[pausa-registro] Diagnóstico falló", diagCallErr);
          toast.error("No podemos registrar esta pausa", {
            description: message || "Permiso denegado por las reglas de acceso",
          });
        }
      } else {
        toast.error("Algo no salió bien", {
          description: message || "Reintenta o contacta soporte",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  const handleExit = () => {
    if (elapsedSec() > 0 || running) setConfirmExit(true);
    else navigate({ to: "/trabajador" });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 safe-top">
        <Button variant="ghost" size="icon" onClick={handleExit} aria-label="Salir de la pausa">
          <X className="size-5" />
        </Button>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Modo enfoque</p>
        <div className="w-9" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8 flex flex-col gap-5">
        {progQ.isLoading || !pausa ? (
          <StateLoading />
        ) : (
          <>
            <header className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">{pausa.titulo}</h1>
            </header>

            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-10">
                <p className="text-7xl font-bold tabular-nums text-primary" aria-live="polite">
                  {fmt(secsLeft ?? 0)}
                </p>
                <div className="flex gap-2">
                  {running ? (
                    <Button onClick={pause} size="lg" variant="secondary">
                      <Pause className="size-5" /> Pausar
                    </Button>
                  ) : (
                    <Button onClick={start} size="lg" disabled={secsLeft === 0}>
                      <Play className="size-5" />{" "}
                      {secsLeft === durMin * 60 ? "Empezar" : "Continuar"}
                    </Button>
                  )}
                  <Button onClick={reset} size="lg" variant="ghost" aria-label="Reiniciar">
                    <RotateCcw className="size-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {pausa.video_url && (
              <Card>
                <CardContent className="p-2">
                  <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                    <iframe
                      src={pausa.video_url}
                      title="Video guía"
                      className="size-full"
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Instrucciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ilustracionUrl && (
                  <div className="flex items-center justify-center rounded-md bg-muted py-6">
                    <img
                      src={ilustracionUrl}
                      alt={`Ilustración de la pausa ${pausa.titulo}`}
                      className="size-32"
                      loading="lazy"
                    />
                  </div>
                )}
                <p className="whitespace-pre-line text-sm leading-relaxed">{pausa.instrucciones}</p>
              </CardContent>
            </Card>

            <div className="sticky bottom-4 mt-auto flex gap-2">
              <Button
                size="lg"
                className="flex-1 text-base"
                onClick={() => registrar("hecha")}
                disabled={submitting}
              >
                Completar
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => registrar("postpuesta")}
                disabled={submitting}
              >
                Más tarde
              </Button>
            </div>
          </>
        )}
      </main>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin completar?</AlertDialogTitle>
            <AlertDialogDescription>
              Si sales ahora, no se registrará esta pausa. Puedes retomarla más tarde desde tu
              inicio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir aquí</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/trabajador" })}>
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showSuccess && <PauseSuccessOverlay onClose={() => navigate({ to: "/trabajador" })} />}
    </div>
  );
}
