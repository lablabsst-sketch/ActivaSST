import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";

export const Route = createFileRoute("/trabajador/pausa/$id")({
  head: () => ({ meta: [{ title: "Pausa — Activa SST" }] }),
  component: PausaPage,
});

function PausaPage() {
  const { id: programacionId } = Route.useParams();
  const navigate = useNavigate();
  const { usuario } = useUsuario();

  const progQ = useQuery({
    queryKey: ["prog-detalle", programacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programaciones")
        .select(
          "id, nombre, pausa_oficial_id, pausas_oficiales(id, titulo, duracion_min, instrucciones, video_url)",
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
        titulo: string;
        duracion_min: number;
        instrucciones: string;
        video_url: string | null;
      }
    | null
    | undefined;
  const durMin = pausa?.duracion_min ?? 3;

  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAtPauseRef = useRef(0);

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
  };

  const elapsedSec = () => {
    let ms = elapsedAtPauseRef.current;
    if (startedAtRef.current) ms += Date.now() - startedAtRef.current;
    return Math.max(0, Math.round(ms / 1000));
  };

  const registrar = async (estado: "hecha" | "postpuesta") => {
    if (!usuario?.id || !pausa?.id) return;
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
      toast.success(estado === "hecha" ? "¡Pausa completada!" : "Te recordaremos en 15 min");
      navigate({ to: "/trabajador" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-2">
        {progQ.isLoading || !pausa ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <header>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pausa</p>
              <h1 className="text-2xl font-bold tracking-tight">{pausa.titulo}</h1>
            </header>

            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-8">
                <p className="text-6xl font-bold tabular-nums text-primary">
                  {fmt(secsLeft ?? 0)}
                </p>
                <div className="flex gap-2">
                  {running ? (
                    <Button onClick={pause} size="lg" variant="secondary">
                      <Pause className="size-5" /> Pausar
                    </Button>
                  ) : (
                    <Button onClick={start} size="lg" disabled={secsLeft === 0}>
                      <Play className="size-5" /> {secsLeft === durMin * 60 ? "Empezar" : "Continuar"}
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
                <CardHeader>
                  <CardTitle className="text-base">Video guía</CardTitle>
                </CardHeader>
                <CardContent>
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
              <CardContent>
                <p className="whitespace-pre-line text-sm">{pausa.instrucciones}</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => registrar("hecha")}
                disabled={submitting}
              >
                Completar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => registrar("postpuesta")}
                disabled={submitting}
              >
                Más tarde
              </Button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
