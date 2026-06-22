import { useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";

const MENSAJES = [
  "¡Tu espalda lo agradece!",
  "5 min bien invertidos",
  "Tu cuerpo te lo paga",
  "Una pausa más, un día más sano",
];

export function PauseSuccessOverlay({ onClose }: { onClose: () => void }) {
  const mensaje = useMemo(
    () => MENSAJES[Math.floor(Math.random() * MENSAJES.length)],
    [],
  );

  useEffect(() => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([120, 60, 120]);
      }
    } catch {
      // noop
    }
    const end = Date.now() + 1500;
    const tick = () => {
      confetti({
        particleCount: 3,
        startVelocity: 28,
        spread: 70,
        ticks: 120,
        origin: { x: Math.random(), y: Math.random() * 0.3 + 0.1 },
        colors: ["#15803d", "#22c55e", "#0ea5e9", "#facc15"],
        disableForReducedMotion: true,
      });
      if (Date.now() < end) requestAnimationFrame(tick);
    };
    tick();
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-live="assertive"
      aria-label="Pausa completada"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm animate-in fade-in"
    >
      <div className="grid size-32 place-items-center rounded-full bg-primary/15 text-primary animate-in zoom-in duration-500">
        <Check className="size-20" strokeWidth={3} aria-hidden />
      </div>
      <div className="space-y-1 text-center px-6">
        <p className="text-2xl font-bold tracking-tight">¡Pausa completada!</p>
        <p className="text-sm text-muted-foreground">{mensaje}</p>
      </div>
    </div>
  );
}
