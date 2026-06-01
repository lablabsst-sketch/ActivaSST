import { createFileRoute } from "@tanstack/react-router";
import { Activity, BarChart3, Bell, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/prevencionista")({
  head: () => ({
    meta: [
      { title: "Panel del prevencionista — Activa SST" },
      {
        name: "description",
        content: "Gestiona programas de pausas activas, equipos y reportes SST.",
      },
    ],
  }),
  component: PrevencionistaPage,
});

const stats = [
  { label: "Trabajadores", value: "—", icon: Users },
  { label: "Pausas hoy", value: "—", icon: Activity },
  { label: "Adherencia", value: "—", icon: BarChart3 },
  { label: "Alertas", value: "—", icon: Bell },
];

function PrevencionistaPage() {
  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Panel</p>
          <h1 className="text-2xl font-bold tracking-tight">Prevencionista</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pronto verás aquí tus programas y reportes de pausas activas.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <Icon className="size-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programa activo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aún no has configurado programas de pausas activas.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
