import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPoliticaVigente = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("politicas_tratamiento")
      .select("id, version, vigente_desde, contenido_md")
      .eq("vigente", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const getMiUltimoConsentimiento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("consentimientos")
      .select("version_aviso, aceptado_at, revocado_at")
      .eq("usuario_id", context.userId)
      .is("revocado_at", null)
      .order("aceptado_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const aceptarPoliticaVigente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { version: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("consentimientos").insert({
      usuario_id: context.userId,
      version_aviso: data.version,
      finalidades_aceptadas: ["sst", "pausas_activas", "notificaciones"],
      user_agent: "re-consent-modal",
    });
    if (error) throw error;
    return { ok: true as const };
  });
