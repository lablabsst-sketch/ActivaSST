import { Link } from "@tanstack/react-router";
import { Play, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlotPendiente } from "@/lib/dias-horas";

interface PausaReminderBannerProps {
  slot: SlotPendiente;
  titulo?: string;
  pendientesExtra?: number;
}

/**
 * Aviso in-app que aparece cuando la hora de una pausa ya llegó y el trabajador
 * aún no la ha atendido. Es el recordatorio de la Fase A (sin push server):
 * visible mientras la app está abierta en el dashboard.
 */
export function PausaReminderBanner({
  slot,
  titulo,
  pendientesExtra = 0,
}: PausaReminderBannerProps) {
  const atrasado = slot.atrasadoMin <= 1 ? "ahora" : `hace ${slot.atrasadoMin} min`;

  return (
    <div role="alert" className="rounded-lg border border-primary/30 bg-primary/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Bell className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">Es hora de tu pausa activa</p>
          <p className="text-xs text-muted-foreground">
            {titulo ?? slot.nombre} · programada {slot.hora} ({atrasado})
            {pendientesExtra > 0 && (
              <>
                {" · "}+{pendientesExtra} pendiente
                {pendientesExtra === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="mt-3 w-full">
        <Link to="/trabajador/pausa/$id" params={{ id: slot.programacion_id }}>
          <Play className="size-4" /> Hacer ahora
        </Link>
      </Button>
    </div>
  );
}
