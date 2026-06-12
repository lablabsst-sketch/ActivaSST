// Rate limiter en memoria (best-effort en Workers: por isolate).
// Suficiente para frenar abusos triviales en MVP; defensa en profundidad
// se delega a Cloudflare frente al borde.

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: existing.resetAt - now };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetIn: existing.resetAt - now,
  };
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
