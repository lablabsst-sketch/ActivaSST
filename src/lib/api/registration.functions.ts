import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Auto-registro: el prevencionista crea la fila en public.usuarios.
// El propio usuario va a /login → tab "Crear cuenta" y se registra
// con su email/cédula + password. NO se usa magic link.
// ============================================================

const NEUTRAL_ERROR =
  "No pudimos verificar tu cuenta. Si crees que es un error, contacta a tu prevencionista.";

const checkSchema = z.object({
  identificador: z.string().trim().min(4),
});

export const checkRegistrationEligibility = createServerFn({ method: "POST" })
  .inputValidator((d) => checkSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const id = data.identificador.trim();
    const isEmail = id.includes("@");

    const query = supabaseAdmin
      .from("usuarios")
      .select("id, email, nombre, password_set, estado")
      .limit(1);
    const { data: row, error } = isEmail
      ? await query.ilike("email", id).maybeSingle()
      : await query.eq("documento", id).maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) {
      return { ok: false as const, motivo: NEUTRAL_ERROR };
    }
    if (row.estado === "inactivo") {
      return { ok: false as const, motivo: NEUTRAL_ERROR };
    }
    if (row.password_set) {
      return {
        ok: false as const,
        motivo: "Ya tienes una cuenta. Inicia sesión con tu contraseña.",
        already_registered: true as const,
      };
    }

    return {
      ok: true as const,
      usuario_id: row.id,
      email: row.email,
      nombre: row.nombre ?? "",
    };
  });

const completeSchema = z.object({
  usuario_id: z.string().uuid(),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Incluye al menos una mayúscula")
    .regex(/[0-9]/, "Incluye al menos un número"),
});

export const completeRegistration = createServerFn({ method: "POST" })
  .inputValidator((d) => completeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Re-valida que la fila exista, no tenga password aún y no esté inactiva.
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("usuarios")
      .select("id, email, password_set, estado")
      .eq("id", data.usuario_id)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error(NEUTRAL_ERROR);
    if (row.estado === "inactivo") throw new Error(NEUTRAL_ERROR);
    if (row.password_set) {
      throw new Error("Ya tienes una cuenta. Inicia sesión con tu contraseña.");
    }

    // Crea el auth user con el MISMO UUID que la fila en usuarios.
    // email_confirm:true evita que se envíe correo de verificación.
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      id: row.id,
      email: row.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr) {
      // Si el auth user ya existe (caso edge: previamente se creó), actualiza password.
      if (createErr.message.toLowerCase().includes("already")) {
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
          row.id,
          { password: data.password, email_confirm: true },
        );
        if (updErr) throw new Error(updErr.message);
      } else {
        throw new Error(createErr.message);
      }
    }

    // Verifica que el auth.user quedó realmente persistido ANTES de marcar
    // password_set=true. Evita desincronía entre public.usuarios y auth.users.
    const { data: verify, error: verifyErr } =
      await supabaseAdmin.auth.admin.getUserById(row.id);
    if (verifyErr || !verify?.user) {
      throw new Error(
        "No pudimos confirmar la creación de tu cuenta. Intenta de nuevo en unos segundos.",
      );
    }

    const { error: markErr } = await supabaseAdmin
      .from("usuarios")
      .update({ password_set: true })
      .eq("id", row.id);
    if (markErr) throw new Error(markErr.message);

    return { ok: true as const, email: row.email };
  });
