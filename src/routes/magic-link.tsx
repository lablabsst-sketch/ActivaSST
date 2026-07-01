import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailWarning } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

// ============================================================
// /magic-link
// Legacy: antes procesaba magic links de invitación. El flujo actual
// es self-registro en /login → "Crear cuenta". Esta ruta permanece por
// compatibilidad con enlaces viejos ya enviados por correo y devuelve
// al usuario a /login con un mensaje claro.
// Nota: las recuperaciones de password llegan directo a /restablecer-password.
// ============================================================

export const Route = createFileRoute("/magic-link")({
  head: () => ({
    meta: [
      { title: "Enlace obsoleto — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MagicLinkPage,
});

function MagicLinkPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/login", replace: true }), 4000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <AppShell>
      <section className="flex flex-col items-center gap-4 pt-10 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <MailWarning className="size-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Este enlace ya no aplica</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Ahora usamos un flujo más sencillo: entra a{" "}
          <strong>/login → “Crear cuenta”</strong> con tu correo o cédula y
          configura tu contraseña.
        </p>
        <Button asChild className="mt-2">
          <Link to="/login">Ir a iniciar sesión</Link>
        </Button>
      </section>
    </AppShell>
  );
}
