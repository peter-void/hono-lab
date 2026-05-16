import { z } from "zod";

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).default("PENDING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate: z.iso.datetime("Invalid date format").optional(),
});

// export const updateTaskSchema = createTaskSchema.partial().refine((data) => {
//   console.log(data);
//   return (
//     Object.keys(data).length > 0,
//     {
//       message: "At least one field must be provided",
//     }
//   );
// });

export const updateTaskSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(100).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    dueDate: z.iso.datetime("Invalid date format").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const taskIdSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
});

export const taskQuerySchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type createTaskInput = z.infer<typeof createTaskSchema>;
export type updateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
