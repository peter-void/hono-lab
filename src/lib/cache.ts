import { redis } from "./redis";

const DEFAULT_TTL = 60;

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get<T>(key);
    return data;
  },

  async set(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
    await redis.set(key, JSON.stringify(value), { ex: ttl });
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async delByPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};

export const taskCacheKey = {
  list: (
    userId: string,
    page: number,
    limit: number,
    status?: string,
    priority?: string,
  ) =>
    `tasks:${userId}:${page}:${limit}:${status ?? "ALL"}:${priority ?? "ALL"}`,

  pattern: (userId: string) => `tasks:${userId}:*`,
};
