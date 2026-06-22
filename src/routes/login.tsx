import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Activa SST" },
      { name: "description", content: "Entra a Activa SST con tu correo corporativo." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Correo no válido"),
});
type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Mensaje neutro siempre (FR-019): no revela si el email está en whitelist.
  const NEUTRAL_MESSAGE =
    "Si tu correo está autorizado, recibirás un enlace de acceso en los próximos minutos. Revisa tu bandeja de entrada y spam.";

  // Rate limit cliente: 3 envíos / 60s por email (defensa básica antes de
  // pegarle a Supabase). Almacenado en localStorage para sobrevivir reload.
  const checkLocalCooldown = (email: string): number => {
    if (typeof window === "undefined") return 0;
    try {
      const key = `magic-link-attempts:${email.toLowerCase()}`;
      const raw = window.localStorage.getItem(key);
      const now = Date.now();
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const recent = arr.filter((t) => now - t < 60_000);
      if (recent.length >= 3) return 60 - Math.floor((now - recent[0]!) / 1000);
      recent.push(now);
      window.localStorage.setItem(key, JSON.stringify(recent));
      return 0;
    } catch {
      return 0;
    }
  };

  const onSubmit = async ({ email }: FormValues) => {
    const cooldown = checkLocalCooldown(email);
    if (cooldown > 0) {
      // No revelamos detalles; mismo mensaje neutro.
      setSent(true);
      return;
    }
    // 1) Pre-check whitelist sin filtrar resultado al usuario.
    const { data: whitelisted } = await supabase.rpc("email_is_whitelisted", {
      p_email: email,
    });

    // 2) Solo dispara magic link si está en whitelist.
    if (whitelisted) {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/magic-link` : undefined;
      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
    }

    // 3) Respuesta UI idéntica en ambos casos.
    setSent(true);
  };

  if (sent) {
    return (
      <AppShell>
        <section className="flex flex-col gap-4 pt-4">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Revisa tu correo</h1>
            <p className="text-sm text-muted-foreground">{NEUTRAL_MESSAGE}</p>
          </header>
          <Button variant="outline" onClick={() => setSent(false)}>
            Usar otro correo
          </Button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">
            Te enviaremos un enlace mágico a tu correo autorizado por tu empresa.
          </p>
        </header>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tu@empresa.co"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar enlace mágico"}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          ¿Ya tienes el enlace?{" "}
          <Link to="/magic-link" className="text-primary underline-offset-4 hover:underline">
            Ábrelo aquí
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
