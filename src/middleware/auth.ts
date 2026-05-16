import { createMiddleware } from "hono/factory";
import type { Variables } from "../types";
import { HTTPException } from "hono/http-exception";
import jwt from "jsonwebtoken";

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
      };

      c.set("userId", decoded.userId);
      c.set("userEmail", decoded.email);

      await next();
    } catch (error) {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }
  },
);
