import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Activa SST" },
      { name: "description", content: "Entra a Activa SST con tu cédula y contraseña." },
    ],
  }),
  component: LoginPage,
});

const NEUTRAL_ERROR = "Credenciales inválidas. Verifica tus datos e intenta de nuevo.";

// ---------- Rate limit por cédula (5/min, lock 15min) ----------
const LOCK_KEY = (c: string) => `login-lock:${c}`;
const ATTEMPTS_KEY = (c: string) => `login-attempts:${c}`;
function getLockRemaining(cedula: string): number {
  try {
    const v = localStorage.getItem(LOCK_KEY(cedula));
    if (!v) return 0;
    const until = parseInt(v, 10);
    const left = until - Date.now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
  } catch {
    return 0;
  }
}
function pushAttempt(cedula: string): { locked: boolean; remaining: number } {
  try {
    const now = Date.now();
    const arr: number[] = JSON.parse(localStorage.getItem(ATTEMPTS_KEY(cedula)) ?? "[]");
    const recent = arr.filter((t) => now - t < 60_000);
    recent.push(now);
    localStorage.setItem(ATTEMPTS_KEY(cedula), JSON.stringify(recent));
    if (recent.length >= 5) {
      const until = now + 15 * 60_000;
      localStorage.setItem(LOCK_KEY(cedula), String(until));
      return { locked: true, remaining: 15 * 60 };
    }
    return { locked: false, remaining: 0 };
  } catch {
    return { locked: false, remaining: 0 };
  }
}

const cedulaSchema = z.object({
  cedula: z.string().trim().min(4, "Cédula no válida"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
const emailSchema = z.object({
  email: z.string().email("Correo no válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"cedula" | "email">("cedula");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash ?? "";
    const search = window.location.search ?? "";
    if (
      hash.includes("access_token=") ||
      hash.includes("error=") ||
      /[?&](code|token_hash|error)=/.test(search)
    ) {
      // Si parece recovery, redirige a restablecer; si no, a magic-link.
      const isRecovery = hash.includes("type=recovery") || /[?&]type=recovery/.test(search);
      const dest = isRecovery ? "/restablecer-password" : "/magic-link";
      window.location.replace(`${dest}${search}${hash}`);
    }
  }, []);

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">
            Entra con tu cédula y contraseña. La primera vez usaste un enlace por correo.
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cedula">Cédula</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="cedula" className="pt-4">
            <CedulaForm onSuccess={(uid) => routeByRol(uid, navigate)} />
            <ForgotLink />
          </TabsContent>

          <TabsContent value="email" className="pt-4">
            <EmailForm onSuccess={(uid) => routeByRol(uid, navigate)} />
            <ForgotLink />
          </TabsContent>
        </Tabs>
      </section>
    </AppShell>
  );
}

async function routeByRol(
  userId: string,
  navigate: ReturnType<typeof useNavigate>,
) {
  const { data: pwSet } = await (
    supabase as unknown as { rpc: (n: string) => Promise<{ data: boolean | null }> }
  ).rpc("current_password_set");
  if (!pwSet) {
    navigate({ to: "/perfil/configurar-password", replace: true });
    return;
  }
  const { data: u } = await supabase
    .from("usuarios")
    .select("rol, estado")
    .eq("id", userId)
    .maybeSingle();
  if (!u) return navigate({ to: "/login", replace: true });
  if (u.estado === "pendiente") return navigate({ to: "/onboarding", replace: true });
  navigate({
    to: u.rol === "trabajador" ? "/trabajador" : "/prevencionista",
    replace: true,
  });
}

function CedulaForm({ onSuccess }: { onSuccess: (userId: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<z.infer<typeof cedulaSchema>>({ resolver: zodResolver(cedulaSchema) });
  const cedula = watch("cedula") ?? "";
  const lockLeft = cedula ? getLockRemaining(cedula) : 0;

  const onSubmit = async (v: z.infer<typeof cedulaSchema>) => {
    const left = getLockRemaining(v.cedula);
    if (left > 0) {
      toast.error(`Demasiados intentos. Reintenta en ${Math.ceil(left / 60)} min.`);
      return;
    }
    const { data: email } = await (
      supabase as unknown as {
        rpc: (n: string, args: Record<string, string>) => Promise<{ data: string | null }>;
      }
    ).rpc("get_login_email_by_cedula", { p_cedula: v.cedula.trim() });
    if (!email) {
      pushAttempt(v.cedula);
      toast.error(NEUTRAL_ERROR);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: v.password,
    });
    if (error || !data.session) {
      pushAttempt(v.cedula);
      toast.error(NEUTRAL_ERROR);
      return;
    }
    onSuccess(data.session.user.id);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cedula">Cédula</Label>
        <Input
          id="cedula"
          inputMode="numeric"
          autoComplete="username"
          placeholder="1023456789"
          {...register("cedula")}
        />
        {errors.cedula && <p className="text-xs text-destructive">{errors.cedula.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cedula-pw">Contraseña</Label>
        <Input
          id="cedula-pw"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      {lockLeft > 0 && (
        <p className="text-xs text-destructive">
          Bloqueado por {Math.ceil(lockLeft / 60)} min por seguridad.
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || lockLeft > 0}
      >
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

function EmailForm({ onSuccess }: { onSuccess: (userId: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const onSubmit = async (v: z.infer<typeof emailSchema>) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: v.email,
      password: v.password,
    });
    if (error || !data.session) {
      toast.error(NEUTRAL_ERROR);
      return;
    }
    onSuccess(data.session.user.id);
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email-login">Correo</Label>
        <Input
          id="email-login"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.co"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-pw">Contraseña</Label>
        <Input
          id="email-pw"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

function ForgotLink() {
  return (
    <p className="pt-3 text-center text-xs text-muted-foreground">
      <Link
        to="/recuperar-password"
        className="text-primary underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </p>
  );
}
