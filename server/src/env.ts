import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(20),
  CORS_ORIGIN: z.string().optional(),
  FOUNDER_EMAIL: z.string().email().default("admin@ethara.app"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().default(10)
});

export const env = EnvSchema.parse(process.env);

