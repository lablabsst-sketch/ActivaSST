import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tipoEnum = z.enum([
  "acceso",
  "rectificacion",
  "cancelacion",
  "oposicion",
  "revocacion",
]);

/** Crear solicitud ARCO del usuario autenticado. */
export const crearSolicitudArco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tipo: tipoEnum,
        descripcion: z.string().trim().min(5).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: u, error: uErr } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("id", userId)
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (!u?.empresa_id) throw new Error("Usuario sin empresa asignada");

    const { data: row, error } = await supabase
      .from("solicitudes_arco")
      .insert({
        usuario_id: userId,
        empresa_id: u.empresa_id,
        tipo: data.tipo,
        descripcion: data.descripcion,
      })
      .select("id, tipo, estado, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Lista solicitudes del usuario autenticado. */
export const listarMisSolicitudesArco = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("solicitudes_arco")
      .select("id, tipo, descripcion, estado, respuesta, created_at, resuelta_at")
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Lista solicitudes de la empresa (sólo prevencionista/empresa_admin via RLS). */
export const listarSolicitudesArcoEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("solicitudes_arco")
      .select(
        "id, tipo, descripcion, estado, respuesta, created_at, resuelta_at, usuario_id, usuarios!solicitudes_arco_usuario_id_fkey(nombre, email)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Resuelve o rechaza una solicitud (sólo staff via RLS). */
export const resolverSolicitudArco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        estado: z.enum(["resuelta", "rechazada", "en_revision"]),
        respuesta: z.string().trim().min(3).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const resolved = data.estado === "resuelta" || data.estado === "rechazada";
    const patch = {
      estado: data.estado,
      respuesta: data.respuesta,
      resuelta_at: resolved ? new Date().toISOString() : null,
      resuelta_por: resolved ? userId : null,
    };
    const { error } = await supabase
      .from("solicitudes_arco")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exporta TODOS los datos del usuario autenticado (derecho de acceso). */
export const exportarMisDatos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [usuario, consentimientos, tipos, registros, solicitudes] = await Promise.all([
      supabase.from("usuarios").select("*").eq("id", userId).maybeSingle(),
      supabase.from("consentimientos").select("*").eq("usuario_id", userId),
      supabase
        .from("usuario_tipos_trabajo")
        .select("tipo_id, tipos_trabajo(nombre)")
        .eq("usuario_id", userId),
      supabase.from("pausa_registros").select("*").eq("trabajador_id", userId),
      supabase.from("solicitudes_arco").select("*").eq("usuario_id", userId),
    ]);

    return {
      generated_at: new Date().toISOString(),
      titular: usuario.data,
      consentimientos: consentimientos.data ?? [],
      tipos_trabajo: tipos.data ?? [],
      pausa_registros: registros.data ?? [],
      solicitudes_arco: solicitudes.data ?? [],
    };
  });
