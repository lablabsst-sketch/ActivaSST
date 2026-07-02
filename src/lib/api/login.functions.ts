import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ cedula: z.string().trim().min(3).max(32) });

/**
 * Resolves a login email from a cedula using admin credentials on the server.
 * Kept behind a server function so the underlying lookup is not directly
 * callable by anonymous Data API clients (prevents easy email enumeration
 * via a public RPC while still supporting pre-auth login by cedula).
 */
export const resolveLoginEmailByCedula = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: email } = await supabase.rpc("get_login_email_by_cedula", {
      p_cedula: data.cedula,
    });
    return { email: (email as string | null) ?? null };
  });

/**
 * Devuelve rol + estado del usuario autenticado desde el server para que el
 * cliente pueda enrutar tras un signIn recién hecho sin depender de que la
 * sesión fresca haya propagado auth.uid() en las cookies del browser.
 * Usa el cliente RLS-scoped del middleware (publishable key + JWT del user),
 * no requiere service_role — auth.uid() se toma directamente del token
 * validado, evitando la race condition del browser.
 */
export const getSessionRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("usuarios")
      .select("rol, estado")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Usuario no encontrado");
    return {
      rol: data.rol as "prevencionista" | "trabajador" | "empresa_admin",
      estado: data.estado as "activo" | "pendiente" | "inactivo",
    };
  });
