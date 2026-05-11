import { z } from "zod";

export const CreateTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  assignedToId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional()
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional()
});

