import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";

// ============================================================
// solicitarRecuperacion
// Endpoint público: dada cédula o email, envía email de reset
// si el usuario existe Y tiene password_set=true. Respuesta neutra.
// ============================================================
const inputSchema = z.object({
  identificador: z.string().trim().min(3).max(120),
  tipo: z.enum(["cedula", "email"]),
});

export const solicitarRecuperacion = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const req = getRequest();
    const ip = req ? getClientIp(req.headers) : "unknown";
    const rl = rateLimit(`recover:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      // mantén neutralidad — no fallar
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Resolver email
    let email: string | null = null;
    if (data.tipo === "email") {
      email = data.identificador.toLowerCase();
    } else {
      const { data: row } = await supabaseAdmin
        .from("usuarios")
        .select("email, password_set, estado")
        .eq("documento", data.identificador)
        .in("estado", ["activo", "pendiente"])
        .maybeSingle();
      if (row?.password_set && row.estado === "activo") email = row.email;
    }
    if (data.tipo === "email" && email) {
      const { data: row } = await supabaseAdmin
        .from("usuarios")
        .select("password_set, estado")
        .eq("email", email)
        .maybeSingle();
      if (!row?.password_set || row.estado !== "activo") email = null;
    }

    if (email) {
      const origin =
        req?.headers.get("origin") ?? process.env.APP_ORIGIN ?? "";
      const redirectTo = origin
        ? `${origin}/restablecer-password`
        : undefined;
      // Usa la plantilla nativa "Reset Password"
      await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
    }

    return { ok: true as const };
  });
