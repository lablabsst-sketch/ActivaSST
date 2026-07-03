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
import {
  checkRegistrationEligibility,
  completeRegistration,
} from "@/lib/api/registration.functions";
import {
  getSessionRouting,
  resolveLoginEmailByCedula,
} from "@/lib/api/login.functions";

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
  const [tab, setTab] = useState<"cedula" | "email" | "registro">("cedula");
  const [prefillEmail, setPrefillEmail] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash ?? "";
    const search = window.location.search ?? "";
    const hasAuthCallback =
      hash.includes("access_token=") ||
      hash.includes("error=") ||
      /[?&](code|token_hash|error)=/.test(search);
    if (!hasAuthCallback) return;
    const isRecovery =
      hash.includes("type=recovery") || /[?&]type=recovery/.test(search);
    if (isRecovery) {
      // Único callback de auth vigente: recuperación de contraseña.
      window.location.replace(`/restablecer-password${search}${hash}`);
      return;
    }
    // Ya no existe flujo magic link: limpiamos cualquier token residual de la
    // URL y dejamos al usuario en /login sin redirigir a rutas eliminadas.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">
            Entra con tu cédula y contraseña. ¿Primera vez? Ve a "Crear cuenta".
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cedula">Cédula</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="cedula" className="pt-4">
            <CedulaForm onSuccess={() => routeBySession(navigate)} />
            <ForgotLink />
          </TabsContent>

          <TabsContent value="email" className="pt-4">
            <EmailForm
              defaultEmail={prefillEmail}
              onSuccess={() => routeBySession(navigate)}
            />
            <ForgotLink />
          </TabsContent>

          <TabsContent value="registro" className="pt-4">
            <RegisterFlow
              onRegistered={(meta) => routeByMeta(meta, navigate)}
              onAlreadyRegistered={(email) => {
                setPrefillEmail(email);
                setTab("email");
                toast.info("Tu cuenta ya existe. Ingresa tu contraseña.");
              }}
            />
          </TabsContent>
        </Tabs>
      </section>
    </AppShell>
  );
}

type UserRol = "prevencionista" | "trabajador" | "empresa_admin";
type UserEstado = "activo" | "pendiente" | "inactivo";

/**
 * Navega según rol + estado ya conocidos, sin volver a consultar la DB.
 * Se usa en flujos donde el server ya devolvió esos datos (evita race
 * conditions de RLS justo después de crear sesión).
 */
function routeByMeta(
  meta: { rol: UserRol; estado: UserEstado },
  navigate: ReturnType<typeof useNavigate>,
) {
  if (meta.estado === "pendiente") {
    return navigate({ to: "/onboarding", replace: true });
  }
  navigate({
    to: meta.rol === "trabajador" ? "/trabajador" : "/prevencionista",
    replace: true,
  });
}

/**
 * Consulta rol+estado en el server (bypass RLS) y navega. Se usa tras un
 * signIn exitoso donde la sesión fresca aún no propaga auth.uid() para las
 * policies RLS del cliente. El server fn ya requiere el JWT válido, así que
 * autoriza y devuelve el routing en una sola llamada.
 */
async function routeBySession(navigate: ReturnType<typeof useNavigate>) {
  try {
    const meta = await getSessionRouting();
    routeByMeta(meta, navigate);
  } catch {
    navigate({ to: "/login", replace: true });
  }
}

function CedulaForm({ onSuccess }: { onSuccess: () => void }) {
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
    const { email } = await resolveLoginEmailByCedula({
      data: { cedula: v.cedula.trim() },
    });
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
    onSuccess();
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

function EmailForm({
  onSuccess,
  defaultEmail,
}: {
  onSuccess: () => void;
  defaultEmail?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: defaultEmail ?? "", password: "" },
  });
  const onSubmit = async (v: z.infer<typeof emailSchema>) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: v.email,
      password: v.password,
    });
    if (error || !data.session) {
      toast.error(NEUTRAL_ERROR);
      return;
    }
    onSuccess();
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

// ============================================================
// RegisterFlow: el prevencionista crea la fila en public.usuarios
// con su email y/o cédula. El propio trabajador entra acá, valida
// que su perfil exista (sin password), crea su password y entra.
// ============================================================
const idSchema = z.object({
  identificador: z.string().trim().min(4, "Ingresa tu correo o cédula"),
});
const pwSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Incluye al menos una mayúscula")
      .regex(/[0-9]/, "Incluye al menos un número"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type Step1 =
  | { kind: "ask" }
  | { kind: "confirm"; usuario_id: string; email_mask: string };

function RegisterFlow({
  onRegistered,
  onAlreadyRegistered,
}: {
  onRegistered: (meta: { rol: UserRol; estado: UserEstado }) => void;
  onAlreadyRegistered: (email: string) => void;
}) {
  const [step, setStep] = useState<Step1>({ kind: "ask" });

  if (step.kind === "ask") {
    return (
      <RegisterIdStep
        onFound={(p) => setStep({ kind: "confirm", ...p })}
        onAlreadyRegistered={onAlreadyRegistered}
      />
    );
  }
  return (
    <RegisterPasswordStep
      usuario_id={step.usuario_id}
      email_mask={step.email_mask}
      onBack={() => setStep({ kind: "ask" })}
      onRegistered={onRegistered}
      onAlreadyRegistered={onAlreadyRegistered}
    />
  );
}

function RegisterIdStep({
  onFound,
  onAlreadyRegistered,
}: {
  onFound: (p: { usuario_id: string; email_mask: string }) => void;
  onAlreadyRegistered: (email: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof idSchema>>({ resolver: zodResolver(idSchema) });

  const onSubmit = async (v: z.infer<typeof idSchema>) => {
    try {
      const res = await checkRegistrationEligibility({
        data: { identificador: v.identificador },
      });
      if (!res.ok) {
        if ("already_registered" in res && res.already_registered) {
          // Conoce el email solo si el usuario lo escribió como identificador.
          const isEmail = v.identificador.includes("@");
          onAlreadyRegistered(isEmail ? v.identificador.trim() : "");
        } else {
          toast.error(res.motivo);
        }
        return;
      }
      onFound({ usuario_id: res.usuario_id, email_mask: res.email_mask });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-id">Correo o cédula</Label>
        <Input
          id="reg-id"
          autoComplete="username"
          placeholder="tu@empresa.co o 1023456789"
          {...register("identificador")}
        />
        {errors.identificador && (
          <p className="text-xs text-destructive">{errors.identificador.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Tu prevencionista debe haberte registrado previamente.
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Verificando…" : "Continuar"}
      </Button>
    </form>
  );
}

function RegisterPasswordStep({
  usuario_id,
  email_mask,
  onBack,
  onRegistered,
  onAlreadyRegistered,
}: {
  usuario_id: string;
  email_mask: string;
  onBack: () => void;
  onRegistered: (meta: { rol: UserRol; estado: UserEstado }) => void;
  onAlreadyRegistered: (email: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });

  const onSubmit = async (v: z.infer<typeof pwSchema>) => {
    try {
      const reg = await completeRegistration({
        data: { usuario_id, password: v.password },
      });
      // El email en claro solo se conoce tras completar el registro (el server
      // lo devuelve una vez creada la cuenta). Se usa para el signIn.
      const email = reg.email;
      // signInWithPassword puede fallar por race-condition (auth.users recién creado).
      // Reintenta una vez con un pequeño delay antes de derivar al flujo de login normal.
      let attempt = await supabase.auth.signInWithPassword({
        email,
        password: v.password,
      });
      if (attempt.error || !attempt.data.session) {
        await new Promise((r) => setTimeout(r, 600));
        attempt = await supabase.auth.signInWithPassword({
          email,
          password: v.password,
        });
      }
      if (attempt.error || !attempt.data.session) {
        // La cuenta ya está creada con su password. Lleva al tab Email precargado.
        onAlreadyRegistered(email);
        return;
      }
      toast.success("¡Bienvenido!");
      // Usamos rol/estado devueltos por el server (evita SELECT RLS-scoped
      // antes de que la sesión fresca esté totalmente propagada).
      onRegistered({ rol: reg.rol, estado: reg.estado });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Cuenta encontrada</p>
        <p className="text-xs text-muted-foreground break-all">{email_mask}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-pw">Nueva contraseña</Label>
        <Input
          id="reg-pw"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Mínimo 8 caracteres, con mayúscula y número.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-pw2">Confirmar contraseña</Label>
        <Input
          id="reg-pw2"
          type="password"
          autoComplete="new-password"
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="text-xs text-destructive">{errors.confirm.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          Atrás
        </Button>
        <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Creando…" : "Crear cuenta y entrar"}
        </Button>
      </div>
    </form>
  );
}
