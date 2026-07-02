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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("usuarios")
      .select("email")
      .eq("documento", data.cedula)
      .in("estado", ["activo", "pendiente"])
      .maybeSingle();
    return { email: row?.email ?? null };
  });

/**
 * Devuelve rol + estado del usuario autenticado desde el server (bypassing RLS)
 * para que el cliente pueda enrutar tras un signIn recién hecho sin depender de
 * que la sesión fresca haya propagado auth.uid() para queries RLS-scoped.
 * Usa el middleware que valida el JWT y extrae userId de los claims.
 */
export const getSessionRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
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
