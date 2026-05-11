import type { Request } from "express";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};

