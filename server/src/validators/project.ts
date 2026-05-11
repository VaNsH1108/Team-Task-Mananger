import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(120, "Project name must be at most 120 characters"),
  description: z.string().trim().max(1000, "Description must be at most 1000 characters").optional()
});

export const UpdateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(120, "Project name must be at most 120 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be at most 1000 characters")
    .nullable()
    .optional()
});

export const AddMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid member email"),
  role: z.enum(["ADMIN", "MEMBER"]).optional()
});

