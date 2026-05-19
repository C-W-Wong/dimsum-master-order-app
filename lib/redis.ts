import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/**
 * Lazy Upstash Redis client.
 *
 * Picks up credentials from either the Vercel Marketplace Upstash integration
 * (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) or a manual Upstash project
 * (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
 */
export function getRedis(): Redis {
  if (_redis) return _redis;

  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing Upstash Redis credentials. Set KV_REST_API_URL and KV_REST_API_TOKEN " +
        "(via Vercel → Storage → Upstash Redis) or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN."
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}
