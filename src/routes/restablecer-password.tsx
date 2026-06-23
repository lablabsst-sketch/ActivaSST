import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordFields, validatePassword } from "@/components/password-fields";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/auth-telemetry";

export const Route = createFileRoute("/restablecer-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RestablecerPasswordPage,
});

type Status = "verifying" | "ready" | "invalid";

function RestablecerPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("verifying");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash,
        );
        logAuthEvent("recovery.visit", {
          hasCode: Boolean(code),
          hasHash: Boolean(window.location.hash),
        });
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            logAuthEvent("recovery.exchange_error", { error: error.message });
            if (!cancelled) setStatus("invalid");
            return;
          }
          logAuthEvent("recovery.exchange_ok");
          window.history.replaceState({}, "", "/restablecer-password");
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          logAuthEvent("recovery.session_ready", {
            userId: data.session.user.id,
            via: code ? "code" : "hash",
          });
          if (!cancelled) setStatus("ready");
          return;
        }
        // Subscribe a PASSWORD_RECOVERY (flujo hash legado)
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (cancelled) return;
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            logAuthEvent("recovery.password_recovery_event", { event });
            setStatus("ready");
          }
        });
        unsub = () => sub.subscription.unsubscribe();
        // Si pasan 4s sin sesión, marcar inválido
        setTimeout(() => {
          if (!cancelled) {
            supabase.auth.getSession().then(({ data: d }) => {
              if (!cancelled && !d.session) {
                logAuthEvent("recovery.session_timeout", {
                  hasHashParam: hashParams.has("access_token"),
                });
                setStatus("invalid");
              }
            });
          }
        }, 4000);
      } catch (err) {
        logAuthEvent("recovery.exchange_error", {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!cancelled) setStatus("invalid");
      }
    };
    void run();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(pw);
    if (err) return toast.error(err);
    if (pw !== confirm) return toast.error("Las contraseñas no coinciden");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await (supabase as unknown as { rpc: (n: string) => Promise<unknown> }).rpc(
        "mark_password_set",
      );
      await supabase.auth.signOut();
      logAuthEvent("recovery.update_ok");
      toast.success("Contraseña actualizada. Inicia sesión.");
      navigate({ to: "/login", replace: true });
    } catch (err) {
      logAuthEvent("recovery.update_error", {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("No se pudo actualizar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  if (status === "verifying") {
    return (
      <AppShell>
        <section className="flex flex-col items-center gap-4 pt-16 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando enlace…</p>
        </section>
      </AppShell>
    );
  }
  if (status === "invalid") {
    return (
      <AppShell>
        <section className="flex flex-col items-center gap-3 pt-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Enlace inválido o expirado</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Solicita un nuevo enlace de recuperación.
          </p>
          <Button onClick={() => navigate({ to: "/recuperar-password" })}>
            Solicitar nuevo enlace
          </Button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-2">
          <div className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Restablece tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Crea una nueva contraseña para tu cuenta.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <PasswordFields
                password={pw}
                confirm={confirm}
                onPassword={setPw}
                onConfirm={setConfirm}
              />
              <Button type="submit" size="lg" className="w-full" disabled={saving}>
                {saving ? "Guardando…" : "Actualizar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
