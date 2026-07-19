import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  nombre: z.string().min(1).max(160),
  logo_url: z.string().url().max(500).nullable().or(z.literal("")),
});

export const updateEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const { data: caller } = await context.supabase
      .from("usuarios")
      .select("empresa_id, rol")
      .eq("id", context.userId)
      .single();
    if (!caller || !caller.empresa_id) throw new Error("Sin empresa");
    if (!["prevencionista", "empresa_admin"].includes(caller.rol)) {
      throw new Error("No autorizado");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const logo = data.logo_url && data.logo_url !== "" ? data.logo_url : null;
    const { error } = await supabaseAdmin
      .from("empresas")
      .update({ nombre: data.nombre, logo_url: logo })
      .eq("id", caller.empresa_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const alertasBajaAdherencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: caller } = await context.supabase
      .from("usuarios")
      .select("empresa_id, rol")
      .eq("id", context.userId)
      .single();
    if (!caller?.empresa_id) return { count: 0, total: 0, sin_programaciones: true };
    if (!["prevencionista", "empresa_admin"].includes(caller.rol)) {
      return { count: 0, total: 0, sin_programaciones: true };
    }

    const { supabase } = context;
    const { data: progs } = await supabase
      .from("programaciones")
      .select("id, dias_semana, horas")
      .eq("empresa_id", caller.empresa_id)
      .eq("activa", true);

    if (!progs || progs.length === 0) {
      return { count: 0, total: 0, sin_programaciones: true };
    }

    const desde = new Date();
    desde.setDate(desde.getDate() - 7);
    desde.setHours(0, 0, 0, 0);

    // denom por trabajador = suma de slots programados últimos 7d (no segmenta por tipo de trabajo aún)
    let slotsPorTrabajador = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dow = d.getDay();
      for (const p of progs) {
        if ((p.dias_semana as number[]).includes(dow)) {
          slotsPorTrabajador += (p.horas as string[]).length;
        }
      }
    }

    const { data: trabajadores } = await supabase
      .from("usuarios")
      .select("id")
      .eq("empresa_id", caller.empresa_id)
      .eq("rol", "trabajador")
      .eq("estado", "activo");

    if (!trabajadores || trabajadores.length === 0) {
      return { count: 0, total: 0, sin_programaciones: false };
    }

    if (slotsPorTrabajador === 0) {
      return { count: 0, total: trabajadores.length, sin_programaciones: false };
    }

    const progIds = progs.map((p) => p.id);
    const { data: registros } = await supabase
      .from("pausa_registros")
      .select("trabajador_id, estado")
      .in("programacion_id", progIds)
      .eq("estado", "hecha")
      .gte("respondido_en", desde.toISOString());

    const conteo = new Map<string, number>();
    for (const r of registros ?? []) {
      conteo.set(r.trabajador_id, (conteo.get(r.trabajador_id) ?? 0) + 1);
    }

    let bajos = 0;
    for (const t of trabajadores) {
      const hechas = conteo.get(t.id) ?? 0;
      const adherencia = hechas / slotsPorTrabajador;
      if (adherencia < 0.5) bajos++;
    }

    return { count: bajos, total: trabajadores.length, sin_programaciones: false };
  });
