import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../types.js";
import { AddMemberSchema, CreateProjectSchema, UpdateProjectSchema } from "../validators/project.js";
import { getUserProjectRole, isAdmin } from "../rbac.js";
import { ProjectRole } from "@prisma/client";
import { env } from "../env.js";

export const projectsRouter = Router();

projectsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projects = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      members: { select: { userId: true, role: true, user: { select: { email: true, name: true } } } }
    }
  });
  return res.json({ projects });
});

projectsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { name, description } = CreateProjectSchema.parse(req.body);

  const existingProjectCount = await prisma.project.count();
  const userEmail = req.user!.email.toLowerCase();
  const founderEmail = env.FOUNDER_EMAIL.toLowerCase();

  if (existingProjectCount === 0) {
    if (userEmail !== founderEmail) {
      return res.status(403).json({ error: "Only the founder can create the first project." });
    }
  } else {
    const adminCount = await prisma.projectMember.count({
      where: { userId, role: ProjectRole.ADMIN }
    });
    if (adminCount === 0) {
      return res.status(403).json({ error: "Only existing project admins can create new projects" });
    }
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      members: { create: { userId, role: ProjectRole.ADMIN } }
    },
    select: { id: true, name: true, description: true, createdAt: true }
  });

  return res.status(201).json({ project });
});

projectsRouter.get("/:projectId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId as string;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  });
  if (!membership) return res.status(403).json({ error: "Not a project member" });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      members: { select: { role: true, user: { select: { id: true, email: true, name: true } } } }
    }
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  return res.json({ project });
});

projectsRouter.patch("/:projectId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId as string;
  const patch = UpdateProjectSchema.parse(req.body);

  const role = await getUserProjectRole(userId, projectId);
  if (!role) return res.status(403).json({ error: "Not a project member" });
  if (!isAdmin(role)) return res.status(403).json({ error: "Admin role required" });

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {})
    },
    select: { id: true, name: true, description: true, updatedAt: true }
  });

  return res.json({ project });
});

projectsRouter.post("/:projectId/members", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId as string;
  const { email, role } = AddMemberSchema.parse(req.body);

  const isFounder = req.user!.email.toLowerCase() === env.FOUNDER_EMAIL.toLowerCase();
  if (!isFounder) {
    return res.status(403).json({ error: "Only the founder can invite users and assign roles." });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    const member = await prisma.projectMember.create({
      data: { userId: user.id, projectId, role: role ? (ProjectRole as any)[role] : ProjectRole.MEMBER },
      select: { id: true, role: true, user: { select: { id: true, email: true, name: true } } }
    });
    return res.status(201).json({ member });
  } catch {
    return res.status(409).json({ error: "User is already a member" });
  }
});

projectsRouter.delete("/:projectId/members/:memberUserId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId as string;
  const memberUserId = req.params.memberUserId as string;

  const isFounder = req.user!.email.toLowerCase() === env.FOUNDER_EMAIL.toLowerCase();
  if (!isFounder) {
    return res.status(403).json({ error: "Only the founder can remove project membership." });
  }

  await prisma.projectMember.delete({
    where: { userId_projectId: { userId: memberUserId, projectId } }
  });
  return res.status(204).send();
});

projectsRouter.delete("/:projectId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId as string;

  const role = await getUserProjectRole(userId, projectId);
  if (!role) return res.status(403).json({ error: "Not a project member" });
  if (!isAdmin(role)) return res.status(403).json({ error: "Admin role required" });

  await prisma.project.delete({
    where: { id: projectId }
  });
  return res.status(204).send();
});

