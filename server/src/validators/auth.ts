import { z } from "zod";

export const EmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address")
});

export const VerifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  code: z.string().trim().length(6, "Enter the 6-digit verification code"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name must be at most 80 characters").optional()
});

export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  password: z.string().min(1, "Password is required")
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

