import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../types.js";
import { CreateTaskSchema, UpdateTaskSchema } from "../validators/task.js";
import { getUserProjectRole, isAdmin } from "../rbac.js";

export const tasksRouter = Router();

tasksRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  const tasks = await prisma.task.findMany({
    where: {
      project: { members: { some: { userId } } },
      ...(projectId ? { projectId } : {})
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } }
    }
  });

  return res.json({ tasks });
});

tasksRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { projectId, title, description, assignedToId, dueDate } = CreateTaskSchema.parse(req.body);

  const role = await getUserProjectRole(userId, projectId);
  if (!role) return res.status(403).json({ error: "Not a project member" });

  // Only admins can assign tasks to others. Members can only self-assign (or unassigned).
  if (assignedToId && assignedToId !== userId && !isAdmin(role)) {
    return res.status(403).json({ error: "Admin role required to assign tasks to others" });
  }

  if (assignedToId) {
    const assigneeMembership = await getUserProjectRole(assignedToId, projectId);
    if (!assigneeMembership) return res.status(400).json({ error: "Assignee is not a project member" });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      dueDate,
      projectId,
      createdById: userId,
      assignedToId: assignedToId ?? null
    },
    select: { id: true, title: true, status: true, dueDate: true, projectId: true }
  });

  return res.status(201).json({ task });
});

tasksRouter.patch("/:taskId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId as string;
  const patch = UpdateTaskSchema.parse(req.body);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, createdById: true }
  });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const role = await getUserProjectRole(userId, task.projectId);
  if (!role) return res.status(403).json({ error: "Not a project member" });

  const updatingAssignee = Object.prototype.hasOwnProperty.call(patch, "assignedToId");
  if (updatingAssignee && patch.assignedToId && patch.assignedToId !== userId && !isAdmin(role)) {
    return res.status(403).json({ error: "Admin role required to reassign tasks to others" });
  }

  if (updatingAssignee && patch.assignedToId) {
    const assigneeMembership = await getUserProjectRole(patch.assignedToId, task.projectId);
    if (!assigneeMembership) return res.status(400).json({ error: "Assignee is not a project member" });
  }

  // Members can update status of tasks within project, but cannot edit title/description/dueDate unless they created the task or are admin.
  const isPrivileged = isAdmin(role) || task.createdById === userId;
  const isEditingMetadata =
    Object.prototype.hasOwnProperty.call(patch, "title") ||
    Object.prototype.hasOwnProperty.call(patch, "description") ||
    Object.prototype.hasOwnProperty.call(patch, "dueDate") ||
    updatingAssignee;

  if (isEditingMetadata && !isPrivileged) {
    return res.status(403).json({ error: "Only task creator or project admin can edit task details" });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
      ...(updatingAssignee ? { assignedToId: patch.assignedToId ?? null } : {})
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      updatedAt: true,
      projectId: true,
      assignedToId: true
    }
  });

  return res.json({ task: updated });
});

tasksRouter.delete("/:taskId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId as string;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, createdById: true }
  });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const role = await getUserProjectRole(userId, task.projectId);
  if (!role) return res.status(403).json({ error: "Not a project member" });

  if (!isAdmin(role) && task.createdById !== userId) {
    return res.status(403).json({ error: "Only task creator or project admin can delete tasks" });
  }

  await prisma.task.delete({ where: { id: taskId } });
  return res.status(204).send();
});

