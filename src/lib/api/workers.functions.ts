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

    const detalles: Detalle[] = [];
    let creados = 0;
    let omitidos = 0;
    let bloqueados = 0;

    for (const t of inputs) {
      try {
        const r = await procesarUno(supabaseAdmin, data.empresa_id, t);
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
      return {
        email: t.email,
        documento: t.documento,
        resultado: "creado",
        motivo: "Reactivado. Debe entrar a /login → Crear cuenta.",
      };
    }
    return { email: t.email, documento: t.documento, resultado: "omitido", motivo: "Ya existe" };
  }

  // Nuevo flujo: solo INSERTAR en public.usuarios. El auth.user se crea
  // cuando el propio usuario va a /login → Crear cuenta y elige password.
  // No se envía email; el prevencionista entrega el dato verbalmente.
  const userId = crypto.randomUUID();
  const { error: insErr } = await supabaseAdmin.from("usuarios").insert({
    id: userId,
    empresa_id,
    rol: "trabajador",
    nombre: t.nombre ?? "",
    documento: t.documento,
    email: t.email,
    estado: t.estado,
    password_set: false,
  });
  if (insErr) {
    return cupoOrError(insErr, t);
  }

  // Asignar tipos de trabajo.
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
// Devuelve las instrucciones para que el prevencionista las
// transmita verbalmente. Ya no se envía email — el trabajador
// se auto-registra en /login → Crear cuenta.
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
      .select("email, documento, empresa_id, estado, password_set")
      .eq("id", data.usuario_id)
      .single();
    if (tErr || !target) throw new Error("Trabajador no encontrado");
    if (target.empresa_id !== caller.empresa_id) throw new Error("Empresa no autorizada");
    if (target.password_set) {
      throw new Error(
        "Este usuario ya configuró contraseña. Pídele que use ¿Olvidaste tu contraseña? en /login.",
      );
    }

    const origin = getRequest()?.headers.get("origin") ?? process.env.APP_ORIGIN ?? "";
    return {
      ok: true,
      email: target.email,
      documento: target.documento,
      instrucciones:
        `Pídele al trabajador que entre a ${origin || "la app"}/login, ` +
        `vaya a la pestaña "Crear cuenta" y use su correo o cédula para configurar su contraseña.`,
    };
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

// ============================================================
// Server Function: deleteWorker
// Elimina permanentemente a un trabajador inactivo (y su auth.user
// si existe). Solo prevencionista|empresa_admin de la misma empresa.
// Requiere que el trabajador esté en estado 'inactivo' como salvaguarda
// para que no se pierda historial accidentalmente.
// ============================================================
export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ usuario_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: caller } = await context.supabase
      .from("usuarios")
      .select("empresa_id, rol")
      .eq("id", context.userId)
      .single();
    if (!caller || !["prevencionista", "empresa_admin"].includes(caller.rol)) {
      throw new Error("No autorizado");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: target, error: tErr } = await supabaseAdmin
      .from("usuarios")
      .select("id, empresa_id, estado, rol")
      .eq("id", data.usuario_id)
      .single();
    if (tErr || !target) throw new Error("Trabajador no encontrado");
    if (target.empresa_id !== caller.empresa_id) {
      throw new Error("Empresa no autorizada");
    }
    if (target.rol !== "trabajador") {
      throw new Error("Solo se pueden eliminar trabajadores");
    }
    if (target.estado !== "inactivo") {
      throw new Error("Primero desactiva al trabajador antes de eliminarlo");
    }

    // 1) Borra vínculos (tipos de trabajo) — por si no hay ON DELETE CASCADE.
    await supabaseAdmin
      .from("usuario_tipos_trabajo")
      .delete()
      .eq("usuario_id", data.usuario_id);

    // 2) Borra la fila de public.usuarios.
    const { error: delErr } = await supabaseAdmin
      .from("usuarios")
      .delete()
      .eq("id", data.usuario_id);
    if (delErr) throw new Error(delErr.message);

    // 3) Si tenía auth.user (password_set=true en algún momento), lo eliminamos.
    // Ignoramos error "user not found" porque puede no existir si nunca completó el registro.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(
      data.usuario_id,
    );
    if (authErr && !authErr.message.toLowerCase().includes("not found")) {
      // El usuario público ya fue borrado; lo reportamos pero no rollback.
      return {
        ok: true,
        warning: `Trabajador eliminado, pero auth.user persiste: ${authErr.message}`,
      };
    }

    return { ok: true };
  });
