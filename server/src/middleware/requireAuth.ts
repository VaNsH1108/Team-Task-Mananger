import type { Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth.js";
import type { AuthedRequest } from "../types.js";

function getBearerToken(req: AuthedRequest) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

