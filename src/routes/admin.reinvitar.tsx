import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { regenerateInviteLink } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/reinvitar")({
  head: () => ({
    meta: [
      { title: "Regenerar invitación — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReinvitarPage,
});

const schema = z.object({
  bootstrap_token: z.string().min(16),
  email: z.string().email(),
});
type FormValues = z.infer<typeof schema>;

function ReinvitarPage() {
  const fn = useServerFn(regenerateInviteLink);
  const [link, setLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    try {
      const res = await fn({ data: v });
      setLink(res.action_link);
      toast.success("Link generado. Cópialo y entrégaselo al usuario.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Regenerar invitación</h1>
          <p className="text-sm text-muted-foreground">
            Genera un nuevo magic link para usuarios que no configuraron contraseña.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="bootstrap_token">Bootstrap token</Label>
            <Input
              id="bootstrap_token"
              type="password"
              autoComplete="off"
              {...register("bootstrap_token")}
            />
            {errors.bootstrap_token && (
              <p className="text-xs text-destructive">{errors.bootstrap_token.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email del usuario</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Generando…" : "Generar link"}
          </Button>
        </form>

        {link && (
          <div className="rounded-md border bg-muted/30 p-4 text-xs space-y-2 break-all">
            <p className="font-semibold">Magic link (entregar manualmente):</p>
            <code className="block">{link}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Copiado");
              }}
            >
              Copiar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
