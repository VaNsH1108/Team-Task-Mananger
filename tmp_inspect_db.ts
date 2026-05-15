import "dotenv/config";
import { prisma } from "./server/src/prisma.ts";

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@ethara.app" } });
  const member = await prisma.user.findUnique({ where: { email: "member@ethara.app" } });
  const projects = await prisma.project.findMany({ include: { members: { include: { user: true } } } });
  console.log(JSON.stringify({ admin, member, projects }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
