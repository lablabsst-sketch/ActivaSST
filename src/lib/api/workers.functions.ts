import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminClient = SupabaseClient;

// ============================================================
// Server Function: importWorkers
// Alta de trabajadores en 3 modos (individual | mini | csv).
// Crea filas en public.usuarios con rol='trabajador' y dispara magic link
// vía Supabase Auth Admin. Honra el trigger check_plan_limit del 0008.
// ============================================================

const altaSchema = z.object({
  documento: z.string().min(5).max(20),
  nombre: z.string().optional(),
  email: z.string().email(),
  tipo_ids: z.array(z.string().uuid()).optional(),
  estado: z.enum(["activo", "pendiente"]),
});

const inputSchema = z.discriminatedUnion("modo", [
  z.object({
    empresa_id: z.string().uuid(),
    modo: z.literal("individual"),
    trabajador: altaSchema,
  }),
  z.object({
    empresa_id: z.string().uuid(),
    modo: z.literal("mini"),
    trabajadores: z.array(altaSchema).min(1),
  }),
  z.object({
    empresa_id: z.string().uuid(),
    modo: z.literal("csv"),
    trabajadores: z.array(altaSchema).min(1),
  }),
]);

type AltaInput = z.infer<typeof altaSchema>;

interface Detalle {
  email: string;
  documento: string;
  resultado: "creado" | "omitido" | "bloqueado_cupo" | "error";
  motivo?: string;
}

export const importWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    // 1) Verifica que el caller es prevencionista|empresa_admin de esa empresa.
    const { data: caller, error: callerErr } = await context.supabase
      .from("usuarios")
      .select("empresa_id, rol")
      .eq("id", context.userId)
      .single();

    if (callerErr || !caller) {
      throw new Error("Perfil no encontrado");
    }
    if (caller.empresa_id !== data.empresa_id) {
      throw new Error("Empresa no autorizada");
    }
    if (!["prevencionista", "empresa_admin"].includes(caller.rol)) {
      throw new Error("Rol no autorizado para esta operación");
    }

    // 2) Itera con el cliente admin (bypassea RLS pero respeta triggers).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inputs: AltaInput[] =
      data.modo === "individual" ? [data.trabajador] : data.trabajadores;

    const origin = getRequest()?.headers.get("origin") ?? process.env.APP_ORIGIN ?? "";
    const redirectTo = origin ? `${origin}/magic-link` : undefined;

    const detalles: Detalle[] = [];
    let creados = 0;
    let omitidos = 0;
    let bloqueados = 0;

    for (const t of inputs) {
      try {
        const r = await procesarUno(supabaseAdmin, data.empresa_id, t, redirectTo);
        detalles.push(r);
        if (r.resultado === "creado") creados++;
        else if (r.resultado === "omitido") omitidos++;
        else if (r.resultado === "bloqueado_cupo") bloqueados++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        detalles.push({
          email: t.email,
          documento: t.documento,
          resultado: "error",
          motivo: message,
        });
      }
    }

    return { creados, omitidos, bloqueados_por_cupo: bloqueados, detalles };
  });

async function procesarUno(
  supabaseAdmin: AdminClient,
  empresa_id: string,
  t: AltaInput,
  redirectTo: string | undefined,
): Promise<Detalle> {
  // ¿Existe por email o documento dentro de la empresa?
  const { data: existing } = await supabaseAdmin
    .from("usuarios")
    .select("id, estado")
    .eq("empresa_id", empresa_id)
    .or(`email.ilike.${t.email},documento.eq.${t.documento}`)
    .maybeSingle();

  if (existing) {
    if (existing.estado === "inactivo") {
      const { error } = await supabaseAdmin
        .from("usuarios")
        .update({ estado: "pendiente" })
        .eq("id", existing.id);
      if (error) return cupoOrError(error, t);
      return invitar(supabaseAdmin, t, redirectTo);
    }
    return { email: t.email, documento: t.documento, resultado: "omitido", motivo: "Ya existe" };
  }

  // 1) Insertar PRIMERO en public.usuarios (el trigger enforce_email_whitelist
  //    sobre auth.users exige que el email exista aquí antes de crear el auth user).
  const userId = crypto.randomUUID();
  const { error: insErr } = await supabaseAdmin.from("usuarios").insert({
    id: userId,
    empresa_id,
    rol: "trabajador",
    nombre: t.nombre ?? "",
    documento: t.documento,
    email: t.email,
    estado: t.estado,
  });
  if (insErr) {
    return cupoOrError(insErr, t);
  }

  // 2) Crear el auth user con el MISMO UUID.
  const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
    id: userId,
    email: t.email,
    email_confirm: false,
  });
  if (createErr) {
    // Rollback: borrar la fila para evitar huérfanos.
    await supabaseAdmin.from("usuarios").delete().eq("id", userId);
    return {
      email: t.email,
      documento: t.documento,
      resultado: "error",
      motivo: createErr.message,
    };
  }

  // 3) Enviar magic link. Si falla, el usuario ya existe — no rollback.
  const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    t.email,
    redirectTo ? { redirectTo } : undefined,
  );

  // 4) Asignar tipos de trabajo.
  if (t.tipo_ids?.length) {
    const rows = t.tipo_ids.map((tipo_id) => ({ usuario_id: userId, tipo_id }));
    const { error: tipoErr } = await supabaseAdmin.from("usuario_tipos_trabajo").insert(rows);
    if (tipoErr) {
      return {
        email: t.email,
        documento: t.documento,
        resultado: "creado",
        motivo: `Creado, pero falló asignar tipos: ${tipoErr.message}`,
      };
    }
  }

  if (invErr) {
    return {
      email: t.email,
      documento: t.documento,
      resultado: "creado",
      motivo: `Creado, pero falló envío de invitación: ${invErr.message}`,
    };
  }

  return { email: t.email, documento: t.documento, resultado: "creado" };
}

async function invitar(
  supabaseAdmin: AdminClient,
  t: AltaInput,
  redirectTo: string | undefined,
): Promise<Detalle> {
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    t.email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) {
    return { email: t.email, documento: t.documento, resultado: "error", motivo: error.message };
  }
  return { email: t.email, documento: t.documento, resultado: "creado" };
}

function cupoOrError(err: { message: string }, t: AltaInput): Detalle {
  if (err.message.toLowerCase().includes("límite del plan")) {
    return {
      email: t.email,
      documento: t.documento,
      resultado: "bloqueado_cupo",
      motivo: err.message,
    };
  }
  return { email: t.email, documento: t.documento, resultado: "error", motivo: err.message };
}

// ============================================================
// Server Function: resendInvite
// Reenvía magic link a un trabajador en estado pendiente.
// ============================================================
export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ usuario_id: z.string().uuid() }),
  )
  .handler(async ({ data, context }) => {
    const { data: caller } = await context.supabase
      .from("usuarios")
      .select("empresa_id, rol")
      .eq("id", context.userId)
      .single();
    if (!caller || !["prevencionista", "empresa_admin"].includes(caller.rol)) {
      throw new Error("No autorizado");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: tErr } = await supabaseAdmin
      .from("usuarios")
      .select("email, empresa_id, estado")
      .eq("id", data.usuario_id)
      .single();
    if (tErr || !target) throw new Error("Trabajador no encontrado");
    if (target.empresa_id !== caller.empresa_id) throw new Error("Empresa no autorizada");

    const origin = getRequest()?.headers.get("origin") ?? process.env.APP_ORIGIN ?? "";
    const redirectTo = origin ? `${origin}/onboarding` : undefined;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      target.email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Server Function: updateWorker
// Edita nombre y tipos de trabajo de un trabajador.
// ============================================================
export const updateWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      usuario_id: z.string().uuid(),
      nombre: z.string().min(1).max(120),
      tipo_ids: z.array(z.string().uuid()),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: caller } = await context.supabase
      .from("usuarios")
      .select("empresa_id, rol")
      .eq("id", context.userId)
      .single();
    if (!caller || !["prevencionista", "empresa_admin"].includes(caller.rol)) {
      throw new Error("No autorizado");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("usuarios")
      .select("empresa_id")
      .eq("id", data.usuario_id)
      .single();
    if (!target || target.empresa_id !== caller.empresa_id) {
      throw new Error("Empresa no autorizada");
    }

    const { error: updErr } = await supabaseAdmin
      .from("usuarios")
      .update({ nombre: data.nombre })
      .eq("id", data.usuario_id);
    if (updErr) throw new Error(updErr.message);

    // Reemplaza tipos
    await supabaseAdmin
      .from("usuario_tipos_trabajo")
      .delete()
      .eq("usuario_id", data.usuario_id);
    if (data.tipo_ids.length) {
      const rows = data.tipo_ids.map((tipo_id) => ({
        usuario_id: data.usuario_id,
        tipo_id,
      }));
      const { error: insErr } = await supabaseAdmin
        .from("usuario_tipos_trabajo")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

