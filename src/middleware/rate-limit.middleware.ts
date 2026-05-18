import type { Ratelimit } from "@upstash/ratelimit";
import { createMiddleware } from "hono/factory";
import { Variables } from "../types";
import { HTTPException } from "hono/http-exception";

export function createRateLimitMiddleware(limiter: Ratelimit) {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const userId = c.get("userId");
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
      c.req.header("x-real-ip") ??
      "127.0.0.1";

    const identifier = userId ?? ip;

    const { success, limit, remaining, reset } =
      await limiter.limit(identifier);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", new Date(reset).toISOString());

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      c.header("Retry-After", String(retryAfter));

      throw new HTTPException(429, {
        message: JSON.stringify({
          success: false,
          message: "Too many requests. Please try again later.",
          retryAfter,
        }),
      });
    }

    await next();
  });
}
