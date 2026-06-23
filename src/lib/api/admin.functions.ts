import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// regenerateInviteLink
// Protegido por BOOTSTRAP_TOKEN. Genera un magic link de invitación
// para reenviar a un usuario que aún no configuró contraseña.
// Devuelve la URL para entregar manualmente.
// ============================================================
const inputSchema = z.object({
  bootstrap_token: z.string().min(16),
  email: z.string().email(),
  origin: z.string().url().optional(),
});

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const regenerateInviteLink = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.BOOTSTRAP_TOKEN ?? "";
    if (!expected || !timingSafeEqualStr(data.bootstrap_token, expected)) {
      throw new Error("Token inválido");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const origin = data.origin ?? process.env.APP_ORIGIN ?? "";
    const redirectTo = origin ? `${origin}/magic-link` : undefined;

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("usuarios")
      .select("id, password_set, estado")
      .eq("email", data.email)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("Usuario no encontrado");
    if (row.password_set) {
      throw new Error(
        "Este usuario ya tiene contraseña. Pídele que use /recuperar-password.",
      );
    }

    const { data: link, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
        options: redirectTo ? { redirectTo } : undefined,
      });
    if (linkErr || !link?.properties?.action_link) {
      throw new Error(linkErr?.message ?? "No se pudo generar el link");
    }
    return {
      ok: true as const,
      action_link: link.properties.action_link,
      hashed_token: link.properties.hashed_token,
      expires_at: link.properties.email_otp ? null : null,
    };
  });
