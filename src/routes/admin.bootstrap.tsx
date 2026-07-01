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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { bootstrapPrevencionista } from "@/lib/api/bootstrap.functions";

export const Route = createFileRoute("/admin/bootstrap")({
  head: () => ({
    meta: [
      { title: "Bootstrap — Activa SST" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BootstrapPage,
});

const planSlugs = ["gratis", "starter", "growth", "business", "enterprise"] as const;

const schema = z.object({
  bootstrap_token: z.string().min(16, "Token muy corto"),
  empresa_nombre: z.string().min(2),
  empresa_nit: z.string().regex(/^\d{6,15}(-\d)?$/, "NIT inválido"),
  plan_slug: z.enum(planSlugs),
  prevencionista_email: z.string().email(),
  prevencionista_nombre: z.string().min(2),
  prevencionista_documento: z.string().min(5).max(20),
});
type FormValues = z.infer<typeof schema>;

function BootstrapPage() {
  const bootstrapFn = useServerFn(bootstrapPrevencionista);
  const [result, setResult] = useState<{
    empresa_id: string;
    usuario_id: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plan_slug: "starter" },
  });

  const planSlug = watch("plan_slug");

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await bootstrapFn({
        data: {
          bootstrap_token: values.bootstrap_token,
          empresa: {
            nombre: values.empresa_nombre,
            nit: values.empresa_nit,
            plan_slug: values.plan_slug,
          },
          prevencionista: {
            email: values.prevencionista_email,
            nombre: values.prevencionista_nombre,
            documento: values.prevencionista_documento,
          },
        },
      });
      setResult({ empresa_id: res.empresa_id, usuario_id: res.usuario_id });
      toast.success(
        'Listo. Ahora entra a /login → "Crear cuenta" con este email para configurar tu contraseña.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Bootstrap prevencionista</h1>
          <p className="text-sm text-muted-foreground">
            Crea la primera empresa + usuario prevencionista. Requiere token.
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
              <p className="text-xs text-destructive">
                {errors.bootstrap_token.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="empresa_nombre">Nombre empresa</Label>
            <Input id="empresa_nombre" {...register("empresa_nombre")} />
            {errors.empresa_nombre && (
              <p className="text-xs text-destructive">
                {errors.empresa_nombre.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="empresa_nit">NIT</Label>
            <Input
              id="empresa_nit"
              placeholder="900000000-1"
              {...register("empresa_nit")}
            />
            {errors.empresa_nit && (
              <p className="text-xs text-destructive">
                {errors.empresa_nit.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="plan_slug">Plan</Label>
            <Select
              value={planSlug}
              onValueChange={(v) => setValue("plan_slug", v as typeof planSlugs[number])}
            >
              <SelectTrigger id="plan_slug">
                <SelectValue placeholder="Selecciona plan" />
              </SelectTrigger>
              <SelectContent>
                {planSlugs.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="prevencionista_email">Email prevencionista</Label>
            <Input
              id="prevencionista_email"
              type="email"
              {...register("prevencionista_email")}
            />
            {errors.prevencionista_email && (
              <p className="text-xs text-destructive">
                {errors.prevencionista_email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="prevencionista_nombre">Nombre prevencionista</Label>
            <Input
              id="prevencionista_nombre"
              {...register("prevencionista_nombre")}
            />
            {errors.prevencionista_nombre && (
              <p className="text-xs text-destructive">
                {errors.prevencionista_nombre.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="prevencionista_documento">Documento</Label>
            <Input
              id="prevencionista_documento"
              {...register("prevencionista_documento")}
            />
            {errors.prevencionista_documento && (
              <p className="text-xs text-destructive">
                {errors.prevencionista_documento.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creando..." : "Crear prevencionista"}
          </Button>
        </form>

        {result && (
          <div className="rounded-md border bg-muted/30 p-4 text-xs space-y-1 font-mono break-all">
            <div>
              <span className="text-muted-foreground">empresa_id:</span>{" "}
              {result.empresa_id}
            </div>
            <div>
              <span className="text-muted-foreground">usuario_id:</span>{" "}
              {result.usuario_id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
