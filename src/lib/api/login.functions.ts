import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
