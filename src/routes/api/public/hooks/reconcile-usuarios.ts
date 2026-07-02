import { createFileRoute } from "@tanstack/react-router";

// Endpoint público llamado por pg_cron. Autenticado con el anon key
// vía header `apikey` (patrón canónico documentado).
// Ejecuta la reconciliación entre public.usuarios y auth.users.
export const Route = createFileRoute("/api/public/hooks/reconcile-usuarios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey");
        if (!anon || apikey !== anon) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        let origen = "cron";
        try {
          const body = (await request.json()) as { origen?: string };
          if (typeof body?.origen === "string" && body.origen.length <= 40) {
            origen = body.origen;
          }
        } catch {
          // sin body → default
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { data, error } = await supabaseAdmin.rpc(
            "reconciliar_usuarios_auth",
            { p_origen: origen },
          );
          if (error) throw new Error(error.message);

          return new Response(
            JSON.stringify({
              ok: true,
              log: data,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Error";
          console.error("[reconcile-usuarios] fallo:", message);
          return new Response(
            JSON.stringify({ ok: false, error: message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
