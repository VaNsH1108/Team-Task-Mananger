import "dotenv/config";
import { prisma } from "./prisma.js";
import { cleanupDatabase, seedDatabase } from "./seed.js";

async function main() {
  console.log("Resetting database and applying fresh seed data...");

  await cleanupDatabase();
  console.log("Database cleared.");

  await seedDatabase();
  console.log("Fresh seed data applied.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
