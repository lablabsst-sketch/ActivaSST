// Telemetría ligera para flujos de Auth (magic-link, recovery, login).
// Loguea en consola del navegador y reenvía (fire-and-forget) al endpoint
// /api/public/auth-event, que a su vez lo emite por console del worker
// para que aparezca en server-function-logs.

export type AuthEventName =
  // /magic-link
  | "magic_link.visit"
  | "magic_link.url_error"
  | "magic_link.exchange_start"
  | "magic_link.exchange_ok"
  | "magic_link.exchange_error"
  | "magic_link.session_ready"
  | "magic_link.session_timeout"
  | "magic_link.already_used"
  | "magic_link.user_lookup_error"
  | "magic_link.account_inactive"
  | "magic_link.route_to_password_setup"
  // /restablecer-password
  | "recovery.visit"
  | "recovery.exchange_ok"
  | "recovery.exchange_error"
  | "recovery.session_ready"
  | "recovery.session_timeout"
  | "recovery.password_recovery_event"
  | "recovery.update_ok"
  | "recovery.update_error"
  // login
  | "login.cedula_attempt"
  | "login.cedula_not_found"
  | "login.email_attempt"
  | "login.signin_ok"
  | "login.signin_error"
  | "login.rate_limited";

type Payload = Record<string, unknown>;

const sessionId = (() => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
})();

function redact(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  // emails / cédulas: deja prefijo y dominio, oculta el resto.
  if (value.includes("@")) {
    const [u, d] = value.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (value.length <= 3) return "***";
  return `${value.slice(0, 2)}***${value.slice(-1)}`;
}

export function logAuthEvent(name: AuthEventName, payload: Payload = {}) {
  const entry = {
    type: "auth_event",
    event: name,
    session: sessionId,
    ts: new Date().toISOString(),
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...payload,
  };
  try {
    // eslint-disable-next-line no-console
    console.info("[auth]", name, entry);
  } catch {
    /* noop */
  }
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(entry);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/public/auth-event", blob);
    } else {
      void fetch("/api/public/auth-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* noop */
  }
}

export const redactIdentifier = redact;
