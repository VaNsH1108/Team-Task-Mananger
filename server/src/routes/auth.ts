import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { LoginSchema, SignupSchema } from "../validators/auth.js";
import { signAccessToken } from "../auth.js";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { email, name, password } = SignupSchema.parse(req.body);

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

