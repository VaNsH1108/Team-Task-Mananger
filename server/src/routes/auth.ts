import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { EmailSchema, LoginSchema, SignupSchema, VerifyCodeSchema } from "../validators/auth.js";
import { signAccessToken } from "../auth.js";
import { sendVerificationCode } from "../email.js";
import { env } from "../env.js";

export const authRouter = Router();

function isGmailAddress(email: string) {
  const domain = email.split("@").pop();
  return domain === "gmail.com" || domain === "googlemail.com";
}

authRouter.post("/signup", async (req, res) => {
  const { email, name, password } = SignupSchema.parse(req.body);

  if (!isGmailAddress(email)) {
    return res.status(400).json({ error: "Please use a Gmail address to sign up." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
    select: { id: true, email: true, name: true }
  });

  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  return res.status(201).json({ user, accessToken });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  return res.json({ user: { id: user.id, email: user.email, name: user.name }, accessToken });
});

authRouter.post("/request-code", async (req, res) => {
  const { email } = EmailSchema.parse(req.body);

  if (!isGmailAddress(email)) {
    return res.status(400).json({ error: "Please use a Gmail address to sign up." });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);

  await prisma.emailVerification.create({
    data: {
      email,
      code,
      expiresAt
    }
  });

  await sendVerificationCode(email, code);
  return res.json({ ok: true });
});

authRouter.post("/verify-code", async (req, res) => {
  const { email, code, name } = VerifyCodeSchema.parse(req.body);

  const verification = await prisma.emailVerification.findFirst({
    where: {
      email,
      code,
      used: false,
      expiresAt: { gte: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!verification) {
    return res.status(400).json({ error: "Invalid or expired verification code." });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!name) {
      return res.status(400).json({ error: "Name is required to create a new account." });
    }
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    user = await prisma.user.create({ data: { email, name, passwordHash } });
  } else if (name && name !== user.name) {
    user = await prisma.user.update({ where: { email }, data: { name } });
  }

  await prisma.emailVerification.update({ where: { id: verification.id }, data: { used: true } });

  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  return res.json({ user: { id: user.id, email: user.email, name: user.name }, accessToken });
});

