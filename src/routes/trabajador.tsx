import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Play, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/trabajador")({
  head: () => ({
    meta: [
      { title: "Mis pausas — Activa SST" },
      { name: "description", content: "Tus pausas activas del día." },
    ],
  }),
  component: TrabajadorPage,
});

function TrabajadorPage() {
  const [showBanner, setShowBanner] = useState(true);

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        {showBanner && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm"
          >
            <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Es hora de tu pausa activa</p>
              <p className="text-xs text-muted-foreground">
                Estírate 3 minutos para cuidar tu espalda.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm">
                  <Play className="size-4" /> Empezar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBanner(false)}>
                  Más tarde
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBanner(false)}
              aria-label="Cerrar aviso"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hola 👋</p>
          <h1 className="text-2xl font-bold tracking-tight">Tu jornada activa</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próxima pausa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-primary">10:30 a. m.</p>
            <p className="text-xs text-muted-foreground">Estiramiento cervical · 3 min</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              0 de 4 pausas completadas. ¡Empieza cuando estés listo!
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
