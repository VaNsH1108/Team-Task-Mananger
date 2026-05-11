import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      message: "Validation error",
      code: "VALIDATION_ERROR",
      issues: err.issues,
      details: err.issues.map((i) => i.message)
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({
      error: err.message,
      message: err.message,
      code: "INTERNAL_ERROR"
    });
  }

  return res.status(500).json({
    error: "Unknown error",
    message: "Unknown error",
    code: "INTERNAL_ERROR"
  });
}

