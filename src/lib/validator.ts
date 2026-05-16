import * as z from "zod";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator as zv } from "@hono/zod-validator";

export const zValidator = <
  T extends z.ZodObject,
  target extends keyof ValidationTargets,
>(
  target: target,
  schema: T,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      throw new HTTPException(400, {
        message: JSON.stringify({
          success: false,
          message: "Validation error",
          errors,
        }),
      });
    }
  });
