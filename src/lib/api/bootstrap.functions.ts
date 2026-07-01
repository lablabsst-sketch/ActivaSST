import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  CEDULA_REGEX,
  NIT_REGEX,
  verificarDigitoNit,
} from "@/lib/validation/nit";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";

// ============================================================
// Server Function: bootstrapPrevencionista
// Crea la primera empresa + fila en public.usuarios (rol=prevencionista).
// NO crea auth.user ni envía correo. El prevencionista entra por
// /login → "Crear cuenta" con su email/cédula para configurar password.
// Protegido por BOOTSTRAP_TOKEN. SIN middleware.
// ============================================================

const planSlugEnum = z.enum([
  "gratis",
  "starter",
  "growth",
  "business",
  "enterprise",
]);

const inputSchema = z.object({
  bootstrap_token: z.string().min(16),
  empresa: z.object({
    nombre: z.string().min(2),
    nit: z
      .string()
      .regex(NIT_REGEX, "NIT inválido")
      .refine(
        (v) => !v.includes("-") || verificarDigitoNit(v),
        "Dígito de verificación NIT incorrecto (algoritmo DIAN)",
      ),
    plan_slug: planSlugEnum,
  }),
  prevencionista: z.object({
    email: z.string().email(),
    nombre: z.string().min(2),
    documento: z.string().regex(CEDULA_REGEX, "Cédula inválida (6-12 dígitos)"),
  }),
});

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const bootstrapPrevencionista = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const req = getRequest();
    const ip = req ? getClientIp(req.headers) : "unknown";
    const rl = rateLimit(`bootstrap:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      throw new Error(
        `Demasiados intentos. Reintenta en ${Math.ceil(rl.resetIn / 1000)}s.`,
      );
    }

    const expected = process.env.BOOTSTRAP_TOKEN ?? "";
    if (!expected || !timingSafeEqualStr(data.bootstrap_token, expected)) {
      throw new Error("Token inválido");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Resolver plan
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("planes")
      .select("id")
      .eq("slug", data.empresa.plan_slug)
      .single();
    if (planErr || !plan) throw new Error("Plan no encontrado");

    // 2. Insertar empresa
    const { data: empresa, error: empErr } = await supabaseAdmin
      .from("empresas")
      .insert({
        nombre: data.empresa.nombre,
        nit: data.empresa.nit,
        plan_id: plan.id,
      })
      .select("id")
      .single();
    if (empErr || !empresa) {
      throw new Error(`No se pudo crear empresa: ${empErr?.message ?? "desconocido"}`);
    }

    // 3. Insertar fila en public.usuarios con password_set=false.
    //    Trigger enforce_email_whitelist necesita esta fila ANTES de auth.user
    //    (que se creará cuando el propio prevencionista use "Crear cuenta").
    const userId = crypto.randomUUID();
    const { error: usrErr } = await supabaseAdmin.from("usuarios").insert({
      id: userId,
      empresa_id: empresa.id,
      rol: "prevencionista",
      nombre: data.prevencionista.nombre,
      documento: data.prevencionista.documento,
      email: data.prevencionista.email,
      estado: "pendiente",
      password_set: false,
    });
    if (usrErr) {
      await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
      throw new Error(`No se pudo crear usuario: ${usrErr.message}`);
    }

    return {
      ok: true as const,
      empresa_id: empresa.id,
      usuario_id: userId,
    };
  });
