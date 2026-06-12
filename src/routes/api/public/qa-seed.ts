import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";

// QA seed endpoint — protegido por BOOTSTRAP_TOKEN + rate limit por IP.
// Crea N usuarios trabajador en una empresa y devuelve magic links.

interface SeedInput {
  bootstrap_token: string;
  empresa_nombre: string;
  trabajadores: Array<{ email: string; nombre?: string }>;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/qa-seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request.headers);
        const rl = rateLimit(`qa-seed:${ip}`, 5, 60_000);
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "rate_limited", resetIn: rl.resetIn }),
            {
              status: 429,
              headers: {
                "content-type": "application/json",
                "retry-after": String(Math.ceil(rl.resetIn / 1000)),
              },
            },
          );
        }
        const body = (await request.json()) as SeedInput;
        const expected = process.env.BOOTSTRAP_TOKEN ?? "";
        if (!expected || !timingSafeEqualStr(body.bootstrap_token ?? "", expected)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const appOrigin = process.env.APP_ORIGIN ?? "";

        // Resolver empresa
        const { data: empresa, error: empErr } = await supabaseAdmin
          .from("empresas")
          .select("id, nombre")
          .ilike("nombre", body.empresa_nombre)
          .maybeSingle();
        if (empErr || !empresa) {
          return new Response(
            JSON.stringify({ error: "empresa_no_encontrada", detail: empErr?.message }),
            { status: 404, headers: { "content-type": "application/json" } },
          );
        }

        const results: Array<Record<string, unknown>> = [];
        for (const t of body.trabajadores) {
          const email = t.email.toLowerCase();
          // Si ya existe en usuarios, lo reutilizamos para generar link
          const { data: existing } = await supabaseAdmin
            .from("usuarios")
            .select("id, email, estado")
            .eq("email", email)
            .maybeSingle();

          let userId = existing?.id as string | undefined;

          if (!userId) {
            userId = crypto.randomUUID();
            const { error: insErr } = await supabaseAdmin.from("usuarios").insert({
              id: userId,
              empresa_id: empresa.id,
              email,
              nombre: t.nombre ?? "",
              rol: "trabajador",
              estado: "pendiente",
            });
            if (insErr) {
              results.push({ email, ok: false, step: "insert_usuarios", error: insErr.message });
              continue;
            }
            const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
              id: userId,
              email,
              email_confirm: true,
            });
            if (authErr) {
              await supabaseAdmin.from("usuarios").delete().eq("id", userId);
              results.push({ email, ok: false, step: "auth_create", error: authErr.message });
              continue;
            }
          }

          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: `${appOrigin}/magic-link` },
          });
          if (linkErr) {
            results.push({ email, ok: false, step: "generate_link", error: linkErr.message });
            continue;
          }
          results.push({
            email,
            ok: true,
            user_id: userId,
            reused: !!existing,
            magic_link: linkData?.properties?.action_link,
          });
        }

        return new Response(JSON.stringify({ empresa, results }, null, 2), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
