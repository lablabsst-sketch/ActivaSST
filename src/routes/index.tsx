import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ShieldCheck, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Activa SST — Pausas activas para tu jornada" },
      {
        name: "description",
        content:
          "Pausas activas guiadas para empresas en Colombia. Cumple con SST cuidando a tu equipo.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Activity className="size-3.5" /> SST Colombia
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          Pausas activas que tu equipo <span className="text-primary">sí hace</span>.
        </h1>
        <p className="text-base text-muted-foreground">
          Activa SST guía pausas cortas durante la jornada para prevenir lesiones y cumplir
          con la normativa colombiana de Seguridad y Salud en el Trabajo.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/login">Soy trabajador</Link>
          </Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            to="/trabajador"
            className="rounded-xl border border-border bg-card p-4 text-card-foreground transition hover:border-primary/40"
          >
            <User className="mb-2 size-5 text-primary" />
            <p className="text-sm font-semibold">Trabajador</p>
            <p className="text-xs text-muted-foreground">Recibe pausas en tu jornada.</p>
          </Link>
          <Link
            to="/prevencionista"
            className="rounded-xl border border-border bg-card p-4 text-card-foreground transition hover:border-primary/40"
          >
            <ShieldCheck className="mb-2 size-5 text-secondary" />
            <p className="text-sm font-semibold">Prevencionista</p>
            <p className="text-xs text-muted-foreground">Gestiona programas y reportes.</p>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
