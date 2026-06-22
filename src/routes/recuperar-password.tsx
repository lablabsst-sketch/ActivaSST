import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { solicitarRecuperacion } from "@/lib/api/recovery.functions";

export const Route = createFileRoute("/recuperar-password")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RecuperarPasswordPage,
});

const schema = z.object({
  identificador: z.string().trim().min(3, "Ingresa un valor válido"),
});
type FormValues = z.infer<typeof schema>;

const NEUTRAL = "Si tu cuenta existe, recibirás un correo con instrucciones.";

function RecuperarPasswordPage() {
  const fn = useServerFn(solicitarRecuperacion);
  const [tipo, setTipo] = useState<"cedula" | "email">("cedula");
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    await fn({ data: { identificador: v.identificador, tipo } }).catch(() => {});
    setSent(true);
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">¿Olvidaste tu contraseña?</h1>
          <p className="text-sm text-muted-foreground">
            Te enviaremos un enlace de recuperación a tu correo registrado.
          </p>
        </header>

        {sent ? (
          <div className="space-y-4 rounded-lg border bg-card p-4 text-center">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="size-6 text-primary" />
            </div>
            <p className="text-sm">{NEUTRAL}</p>
            <Button asChild variant="outline">
              <Link to="/login">Volver a iniciar sesión</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cedula">Cédula</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-1.5">
              <Label htmlFor="ident">{tipo === "cedula" ? "Cédula" : "Correo"}</Label>
              <Input
                id="ident"
                inputMode={tipo === "cedula" ? "numeric" : "email"}
                autoComplete={tipo === "cedula" ? "username" : "email"}
                placeholder={tipo === "cedula" ? "1023456789" : "tu@empresa.co"}
                {...register("identificador")}
              />
              {errors.identificador && (
                <p className="text-xs text-destructive">{errors.identificador.message}</p>
              )}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviar enlace"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="underline-offset-4 hover:underline">
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </section>
    </AppShell>
  );
}
