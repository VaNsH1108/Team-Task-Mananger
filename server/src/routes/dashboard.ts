import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../types.js";
import { prisma } from "../prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const now = new Date();

  const [statusCounts, overdueAssigned, myTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { project: { members: { some: { userId } } } },
      _count: { _all: true }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        dueDate: { lt: now },
        status: { not: "DONE" }
      },
      orderBy: [{ dueDate: "asc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } }
      }
    }),
    prisma.task.findMany({
      where: { assignedToId: userId },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } }
      }
    })
  ]);

  const counts = statusCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  return res.json({
    statusCounts: {
      TODO: counts.TODO ?? 0,
      IN_PROGRESS: counts.IN_PROGRESS ?? 0,
      DONE: counts.DONE ?? 0
    },
    overdueAssigned,
    myTasks
  });
});

