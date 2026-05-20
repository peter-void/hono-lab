import type { Context } from "hono";

type SuccessResponse<T> = {
  success: true;
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

type ErrorResponse = {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
};

export const ok = <T>(
  c: Context,
  data?: T,
  message?: string,
  status: 200 | 201 = 200,
) => {
  const body: SuccessResponse<T> = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return c.json(body, status);
};

export const created = <T>(
  c: Context,
  data?: T,
  message = "Created successfully",
) => {
  return ok(c, data, message, 201);
};

export const paginated = <T>(
  c: Context,
  data: T,
  pagination: SuccessResponse<T>["pagination"],
) => {
  return c.json(
    {
      success: true,
      data,
      pagination,
    } satisfies SuccessResponse<T>,
    200,
  );
};
