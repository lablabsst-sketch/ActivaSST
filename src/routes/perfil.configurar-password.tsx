import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordFields, validatePassword } from "@/components/password-fields";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";

export const Route = createFileRoute("/perfil/configurar-password")({
  head: () => ({
    meta: [
      { title: "Crear contraseña — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConfigurarPasswordPage,
});

function ConfigurarPasswordPage() {
  const navigate = useNavigate();
  const { session, usuario, loading } = useUsuario();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(pw);
    if (err) return toast.error(err);
    if (pw !== confirm) return toast.error("Las contraseñas no coinciden");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await (supabase as unknown as { rpc: (n: string) => Promise<{ error: unknown }> }).rpc(
        "mark_password_set",
      );
      toast.success("Contraseña creada. La próxima vez entrarás con cédula y contraseña.");
      const dest =
        usuario?.rol === "trabajador" ? "/trabajador" : "/prevencionista";
      navigate({ to: dest, replace: true });
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-2">
          <div className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Crea tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Necesaria para entrar rápido con tu cédula sin esperar el correo.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva contraseña</CardTitle>
            <CardDescription className="text-xs">
              Mínimo 8 caracteres, una mayúscula y un número.
            </CardDescription>
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
                {saving ? "Guardando…" : "Guardar y continuar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
