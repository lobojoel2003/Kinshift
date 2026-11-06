/**
 * Small in-memory sliding-window rate limiter. Kinshift runs as a single
 * process per family, so memory is the right place for this.
 */

type Bucket = number[];
const g = globalThis as unknown as { __kinshiftRate?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__kinshiftRate ??= new Map());

export type RateResult = { ok: true } | { ok: false; retryAfterMs: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateResult {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { ok: false, retryAfterMs: windowMs - (now - recent[0]) };
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { ok: true };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
