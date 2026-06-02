import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Server Function: bootstrapPrevencionista
// Crea la primera empresa + usuario prevencionista, protegido por BOOTSTRAP_TOKEN.
// SIN middleware: aún no hay sesión.
// NO importa client.server a nivel de módulo (dynamic import dentro del handler).
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
    nit: z.string().regex(/^\d{6,15}(-\d)?$/, "NIT inválido"),
    plan_slug: planSlugEnum,
  }),
  prevencionista: z.object({
    email: z.string().email(),
    nombre: z.string().min(2),
    documento: z.string().min(5).max(20),
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

    // 3. Insertar usuario PRIMERO (trigger enforce_email_whitelist lo exige)
    const userId = crypto.randomUUID();
    const { error: usrErr } = await supabaseAdmin.from("usuarios").insert({
      id: userId,
      empresa_id: empresa.id,
      rol: "prevencionista",
      nombre: data.prevencionista.nombre,
      documento: data.prevencionista.documento,
      email: data.prevencionista.email,
      estado: "pendiente",
    });
    if (usrErr) {
      await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
      throw new Error(`No se pudo crear usuario: ${usrErr.message}`);
    }

    // 4. Crear auth user con el MISMO UUID
    const origin = process.env.APP_ORIGIN ?? "";
    const redirectTo = origin ? `${origin}/onboarding` : undefined;

    const { data: invited, error: invErr } =
      await supabaseAdmin.auth.admin.createUser({
        id: userId,
        email: data.prevencionista.email,
        email_confirm: false,
      });
    if (invErr || !invited?.user) {
      await supabaseAdmin.from("usuarios").delete().eq("id", userId);
      await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
      throw new Error(
        `No se pudo crear auth user: ${invErr?.message ?? "desconocido"}`,
      );
    }

    // 5. Enviar magic link / invite
    const { error: linkErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.prevencionista.email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (linkErr) {
      return {
        ok: true as const,
        empresa_id: empresa.id,
        usuario_id: userId,
        warning: `Usuario creado pero falló el envío del invite: ${linkErr.message}. Reintenta desde /login con magic link.`,
      };
    }

    return {
      ok: true as const,
      empresa_id: empresa.id,
      usuario_id: userId,
    };
  });
