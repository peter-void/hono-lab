import { describe, it, expect, beforeEach, mock } from "bun:test";

const mockLimit = mock(async () => ({
  success: true,
  limit: 5,
  remaining: 4,
  reset: Date.now() + 60_000,
}));

mock.module("../lib/rate-limit", () => ({
  authRateLimit: { limit: mockLimit },
  apiRateLimit: { limit: mockLimit },
}));

mock.module("../lib/email", () => ({
  sendVerificationEmail: mock(async () => {}),
}));

const { default: app } = await import("..");

const post = (path: string, body: unknown) => {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

describe("Rate Limit Middleware", () => {
  beforeEach(() => {
    mockLimit.mockClear();
    mockLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60_000,
    });
  });

  it("should set rate limit headers on successful request", async () => {
    const res = await post("/auth/login", {
      email: "haikal@gmail.com",
      password: "Password123",
    });

    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("should return 429 when rate limit exceeded", async () => {
    mockLimit.mockImplementation(async () => ({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 30_000,
    }));

    const res = await post("/auth/login", {
      email: "haikal@gmail.com",
      password: "Password123",
    });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Too many requests. Please try again later.");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
