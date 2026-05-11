import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional()
});

export const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).optional()
});

