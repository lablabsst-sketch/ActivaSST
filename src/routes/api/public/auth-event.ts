import { createFileRoute } from "@tanstack/react-router";

// Endpoint público que recibe eventos de Auth desde el cliente y los emite
// por console.log del worker. Aparecen en server-function-logs para depurar
// magic links expirados, recuperaciones fallidas, etc.
//
// Sin escritura a DB ni PII cruda (el cliente ya redacta identificadores).

const ALLOWED_EVENTS = new Set([
  "magic_link.visit",
  "magic_link.url_error",
  "magic_link.exchange_start",
  "magic_link.exchange_ok",
  "magic_link.exchange_error",
  "magic_link.session_ready",
  "magic_link.session_timeout",
  "magic_link.already_used",
  "magic_link.user_lookup_error",
  "magic_link.account_inactive",
  "magic_link.route_to_password_setup",
  "recovery.visit",
  "recovery.exchange_ok",
  "recovery.exchange_error",
  "recovery.session_ready",
  "recovery.session_timeout",
  "recovery.password_recovery_event",
  "recovery.update_ok",
  "recovery.update_error",
  "login.cedula_attempt",
  "login.cedula_not_found",
  "login.email_attempt",
  "login.signin_ok",
  "login.signin_error",
  "login.rate_limited",
]);

function truncate(v: unknown, max = 200): unknown {
  if (typeof v !== "string") return v;
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

export const Route = createFileRoute("/api/public/auth-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          if (raw.length > 4096) {
            return new Response("payload too large", { status: 413 });
          }
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return new Response("bad json", { status: 400 });
          }
          const event = String(parsed.event ?? "");
          if (!ALLOWED_EVENTS.has(event)) {
            return new Response("unknown event", { status: 400 });
          }
          const safe: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(parsed)) {
            safe[k] = truncate(v);
          }
          safe.ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for") ??
            "unknown";
          safe.ua = truncate(request.headers.get("user-agent") ?? "", 120);
          // eslint-disable-next-line no-console
          console.log("[auth_event]", JSON.stringify(safe));
          return new Response(null, { status: 204 });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            "[auth_event] handler error",
            err instanceof Error ? err.message : String(err),
          );
          return new Response("err", { status: 500 });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
    },
  },
});
