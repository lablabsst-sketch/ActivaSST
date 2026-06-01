import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/magic-link")({
  head: () => ({
    meta: [
      { title: "Enlace mágico — Activa SST" },
      { name: "description", content: "Revisa tu correo para entrar a Activa SST." },
    ],
  }),
  component: MagicLinkPage,
});

function MagicLinkPage() {
  return (
    <AppShell>
      <section className="flex flex-col items-center gap-4 pt-10 text-center">
        <div className="rounded-full bg-accent p-4 text-accent-foreground">
          <MailCheck className="size-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Revisa tu correo</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Te enviamos un enlace mágico. Ábrelo desde este mismo dispositivo para iniciar sesión.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/login">Volver</Link>
        </Button>
      </section>
    </AppShell>
  );
}
