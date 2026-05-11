import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(8).max(72)
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

