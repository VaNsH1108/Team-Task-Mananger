import { ProjectRole } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function getUserProjectRole(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true }
  });
  return membership?.role ?? null;
}

export function isAdmin(role: ProjectRole | null) {
  return role === ProjectRole.ADMIN;
}

