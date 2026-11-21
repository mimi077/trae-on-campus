import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/server/seed-database";

const db = new PrismaClient();

async function main() {
  await seedDatabase(db);
  console.log("Seed finished: users ensured, demo data ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
