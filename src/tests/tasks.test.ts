import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import app from "../index";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const testUser = {
  name: "Haikal Task Test",
  email: "haikal.task.test@gmail.com",
  password: "Password123",
};

let token: string;
let taskId: string;

const post = (path: string, body: unknown, authToken?: string) =>
  app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    body: JSON.stringify(body),
  });

const get = (path: string, authToken?: string) =>
  app.request(path, {
    method: "GET",
    headers: {
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
  });

const put = (path: string, body: unknown, authToken?: string) =>
  app.request(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    body: JSON.stringify(body),
  });

const del = (path: string, authToken?: string) =>
  app.request(path, {
    method: "DELETE",
    headers: {
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
  });

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: testUser.email } });

  const hashed = await bcrypt.hash(testUser.password, 10);
  await prisma.user.create({
    data: { ...testUser, password: hashed, isVerified: true },
  });

  const res = await post("/auth/login", {
    email: testUser.email,
    password: testUser.password,
  });
  const body = await res.json();
  token = body.data.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testUser.email } });
  await prisma.$disconnect();
});

describe("POST /tasks", () => {
  it("should create task successfully", async () => {
    const res = await post(
      "/tasks",
      {
        title: "Belajar Hono",
        priority: "HIGH",
      },
      token,
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Belajar Hono");

    taskId = body.data.id;
  });

  it("should reject request without token", async () => {
    const res = await post("/tasks", { title: "Test" });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("should reject empty title", async () => {
    const res = await post("/tasks", { title: "" }, token);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors[0].field).toBe("title");
  });
});

describe("GET /tasks", () => {
  it("should return tasks with pagination", async () => {
    const res = await get("/tasks", token);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it("should filter by status", async () => {
    const res = await get("/tasks?status=PENDING", token);
    const body = await res.json();

    expect(res.status).toBe(200);
    body.data.forEach((task: any) => {
      expect(task.status).toBe("PENDING");
    });
  });

  it("should reject request without token", async () => {
    const res = await get("/tasks");

    expect(res.status).toBe(401);
  });
});

describe("GET /tasks/:id", () => {
  it("should return task by id", async () => {
    const res = await get(`/tasks/${taskId}`, token);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(taskId);
  });

  it("should return 404 for non-existent task", async () => {
    const res = await get("/tasks/non-existent-id", token);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });
});

describe("PUT /tasks/:id", () => {
  it("should update task successfully", async () => {
    const res = await put(
      `/tasks/${taskId}`,
      {
        status: "IN_PROGRESS",
        priority: "LOW",
      },
      token,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("IN_PROGRESS");
    expect(body.data.priority).toBe("LOW");
  });

  it("should reject empty body", async () => {
    const res = await put(`/tasks/${taskId}`, {}, token);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Validation error");
  });
});

describe("DELETE /tasks/:id", () => {
  it("should delete task successfully", async () => {
    const res = await del(`/tasks/${taskId}`, token);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("should return 404 after deleted", async () => {
    const res = await get(`/tasks/${taskId}`, token);

    expect(res.status).toBe(404);
  });
});
