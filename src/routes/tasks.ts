import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../lib/prisma";
import { created, ok, paginated } from "../lib/response";
import { zValidator } from "../lib/validator";
import { authMiddleware } from "../middleware/auth";
import { Variables } from "../types";
import {
  createTaskSchema,
  taskIdSchema,
  taskQuerySchema,
  updateTaskSchema,
} from "../validators/task.validator";
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { apiRateLimit } from "../lib/rate-limit";
import { cache, taskCacheKey } from "../lib/cache";

const tasks = new Hono<{ Variables: Variables }>();

tasks.use(authMiddleware);
tasks.use(createRateLimitMiddleware("api"));

tasks.get("/", zValidator("query", taskQuerySchema), async (c) => {
  const userId = c.get("userId");
  const { status, priority, page, limit } = c.req.valid("query");

  const cacheKey = taskCacheKey.list(userId, page, limit, status, priority);

  const cached = await cache.get(cacheKey);
  if (cached) {
    return paginated(c, (cached as any).tasks, (cached as any).pagination);
  }

  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(status && { status }),
    ...(priority && { priority }),
  };

  const [taskList, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.task.count({
      where,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const pagination = {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };

  await cache.set(cacheKey, { tasks: taskList, pagination });

  return paginated(c, taskList, pagination);
});

tasks.get("/:id", zValidator("param", taskIdSchema), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.valid("param");

  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (task.userId !== userId) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return ok(c, task);
});

tasks.post("/", zValidator("json", createTaskSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const task = await prisma.task.create({
    data: {
      ...body,
      userId,
    },
  });

  await cache.delByPattern(taskCacheKey.pattern(userId));

  return created(c, task);
});

tasks.put(
  "/:id",
  zValidator("param", taskIdSchema),
  zValidator("json", updateTaskSchema),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new HTTPException(404, { message: "Task not found" });
    }

    if (task.userId !== userId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: body,
    });

    await cache.delByPattern(taskCacheKey.pattern(userId));

    return ok(c, updatedTask, "Task updated");
  },
);

tasks.delete("/:id", zValidator("param", taskIdSchema), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.valid("param");

  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (task.userId !== userId) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  await prisma.task.delete({
    where: { id },
  });

  await cache.delByPattern(taskCacheKey.pattern(userId));

  return ok(c, undefined, "Task deleted");
});

export default tasks;
