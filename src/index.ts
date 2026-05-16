import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import auth from "./routes/auth";
import { Variables } from "./types";
import tasks from "./routes/tasks";

const app = new Hono<{ Variables: Variables }>();

app.use(logger());
app.use(cors());

app.get("/", (c) => {
  return c.json({ message: "Task Manager API", status: "OK" });
});

app.route("/auth", auth);
app.route("/tasks", tasks);

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    try {
      const body = JSON.parse(err.message);
      return c.json(body, err.status);
    } catch {
      return c.json({ success: false, message: err.message }, err.status);
    }
  }

  console.error(err);
  return c.json({ success: false, message: "Internal server error" }, 500);
});

app.notFound((c) => {
  return c.json(
    { success: false, message: `Route ${c.req.path} not found` },
    404,
  );
});

export default app;
