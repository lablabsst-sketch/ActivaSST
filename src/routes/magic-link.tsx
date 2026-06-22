import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MailWarning } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/magic-link")({
  head: () => ({
    meta: [
      { title: "Verificando enlace — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MagicLinkPage,
});

type Status = "loading" | "error" | "already_used";

function MagicLinkPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const routeForUser = async (userId: string) => {
      // ¿Tiene password? Si SÍ, este enlace ya fue usado (es de invitación única).
      const { data: pwSet } = await (
        supabase as unknown as {
          rpc: (n: string) => Promise<{ data: boolean | null }>;
        }
      ).rpc("current_password_set");
      if (cancelled) return;
      if (pwSet) {
        // Cerrar sesión para que entre con su password
        await supabase.auth.signOut();
        if (cancelled) return;
        setStatus("already_used");
        return;
      }
      const { data: usuario, error } = await supabase
        .from("usuarios")
        .select("rol, estado")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !usuario) {
        setErrorMsg("Tu cuenta no está registrada. Pide acceso a tu prevencionista.");
        setStatus("error");
        return;
      }
      if (usuario.estado === "inactivo") {
        setErrorMsg("Tu cuenta está inactiva. Contacta a tu prevencionista.");
        setStatus("error");
        return;
      }
      // password_set=false → siempre a configurar contraseña
      navigate({ to: "/perfil/configurar-password", replace: true });
    };

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash,
        );
        const hashError = hashParams.get("error_description") ?? hashParams.get("error");
        const queryError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (hashError || queryError) {
          setErrorMsg(hashError ?? queryError ?? "Enlace inválido");
          setStatus("error");
          return;
        }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMsg(error.message);
            setStatus("error");
            return;
          }
        }
        window.history.replaceState({}, "", "/magic-link");
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.id) {
            await routeForUser(data.session.user.id);
            return;
          }
          await new Promise((r) => setTimeout(r, 150));
          if (cancelled) return;
        }
        setErrorMsg("Este enlace expiró o ya fue usado.");
        setStatus("error");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
        setStatus("error");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === "loading") {
    return (
      <AppShell>
        <section className="flex flex-col items-center gap-4 pt-16 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">Verificando…</h1>
          <p className="text-sm text-muted-foreground">Un momento, estamos iniciando sesión.</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="flex flex-col items-center gap-4 pt-10 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <MailWarning className="size-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Este enlace expiró</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {errorMsg} ¿Quieres uno nuevo?
        </p>
        <Button asChild className="mt-2">
          <Link to="/login">Pedir nuevo enlace</Link>
        </Button>
      </section>
    </AppShell>
  );
}
