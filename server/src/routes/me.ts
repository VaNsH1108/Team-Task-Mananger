import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../types.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: req.user });
});

