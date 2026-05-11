import { z } from "zod";

export const CreateTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(3, "Task title must be at least 3 characters")
    .max(200, "Task title must be at most 200 characters"),
  description: z.string().trim().max(2000, "Description must be at most 2000 characters").optional(),
  assignedToId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional()
});

export const UpdateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Task title must be at least 3 characters")
    .max(200, "Task title must be at most 200 characters")
    .optional(),
  description: z.string().trim().max(2000, "Description must be at most 2000 characters").optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional()
});

