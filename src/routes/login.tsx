import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (_values: FormValues) => {
    // Placeholder: aquí irá supabase.auth.signInWithOtp({ email })
    await new Promise((r) => setTimeout(r, 400));
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">
            Te enviaremos un enlace mágico a tu correo.
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
