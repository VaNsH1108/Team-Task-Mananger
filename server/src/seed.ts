import "dotenv/config";
import bcrypt from "bcryptjs";
import { ProjectRole, TaskStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

async function upsertUser(email: string, name: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash }
  });
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@ethara.app").toLowerCase();
  const adminName = process.env.SEED_ADMIN_NAME || "Admin User";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminPass123";

  const memberEmail = (process.env.SEED_MEMBER_EMAIL || "member@ethara.app").toLowerCase();
  const memberName = process.env.SEED_MEMBER_NAME || "Team Member";
  const memberPassword = process.env.SEED_MEMBER_PASSWORD || "MemberPass123";

  const admin = await upsertUser(adminEmail, adminName, adminPassword);
  const member = await upsertUser(memberEmail, memberName, memberPassword);

  const projectName = process.env.SEED_PROJECT_NAME || "Hiring Readiness Workspace";
  const project = await prisma.project.upsert({
    where: { id: process.env.SEED_PROJECT_ID || "seed-hiring-workspace" },
    update: {
      name: projectName,
      description: "Production-style workspace seeded for demo and evaluation."
    },
    create: {
      id: process.env.SEED_PROJECT_ID || "seed-hiring-workspace",
      name: projectName,
      description: "Production-style workspace seeded for demo and evaluation."
    }
  });

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: admin.id, projectId: project.id } },
    update: { role: ProjectRole.ADMIN },
    create: { userId: admin.id, projectId: project.id, role: ProjectRole.ADMIN }
  });

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: member.id, projectId: project.id } },
    update: { role: ProjectRole.MEMBER },
    create: { userId: member.id, projectId: project.id, role: ProjectRole.MEMBER }
  });

  const existing = await prisma.task.count({ where: { projectId: project.id } });
  if (existing === 0) {
    await prisma.task.createMany({
      data: [
        {
          title: "Set up project onboarding doc",
          description: "Create onboarding checklist and architecture summary.",
          status: TaskStatus.TODO,
          projectId: project.id,
          createdById: admin.id,
          assignedToId: member.id
        },
        {
          title: "Review RBAC policies",
          description: "Validate member vs admin permissions across key flows.",
          status: TaskStatus.IN_PROGRESS,
          projectId: project.id,
          createdById: admin.id,
          assignedToId: admin.id
        }
      ]
    });
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Member login: ${memberEmail} / ${memberPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

