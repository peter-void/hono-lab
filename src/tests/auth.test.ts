import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

mock.module("../lib/email", () => ({
  sendVerificationEmail: mock(async () => {}),
}));

mock.module("../lib/rate-limit", () => ({
  authRateLimit: {
    limit: mock(async () => ({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60_000,
    })),
  },
  apiRateLimit: {
    limit: mock(async () => ({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    })),
  },
}));

const { default: app } = await import("..");
const { prisma } = await import("../lib/prisma");

const testUser = {
  name: "Haikal test",
  email: "haikal.test@gmail.com",
  password: "Password123",
};

beforeAll(async () => {
  await prisma.user.deleteMany({
    where: { email: testUser.email },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: testUser.email },
  });
  await prisma.$disconnect();
});

const post = (path: string, body: unknown) => {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

describe("POST /auth/register", () => {
  it("should register successfully", async () => {
    const res = await post("/auth/register", testUser);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(testUser.email);
    expect(body.data.password).toBeUndefined();
  });

  it("should reject duplicate email", async () => {
    const res = await post("/auth/register", testUser);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Email already registered");
  });

  it("should reject invalid email", async () => {
    const res = await post("/auth/register", {
      ...testUser,
      email: "bukan-email",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Validation error");
  });

  it("should reject weak password", async () => {
    const res = await post("/auth/register", {
      ...testUser,
      email: "lain@gmail.com",
      password: "weak",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors[0].field).toBe("password");
  });
});

describe("POST /auth/login", () => {
  beforeAll(async () => {
    await prisma.user.update({
      where: { email: testUser.email },
      data: {
        isVerified: true,
      },
    });
  });

  it("should login successfully", async () => {
    const res = await post("/auth/login", {
      email: testUser.email,
      password: testUser.password,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(typeof body.data.token).toBe("string");
  });

  it("should reject wrong password", async () => {
    const res = await post("/auth/login", {
      email: testUser.email,
      password: "WrongPassword123",
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("should reject non-existent email", async () => {
    const res = await post("/auth/login", {
      email: "tidakada@gmail.com",
      password: testUser.password,
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
