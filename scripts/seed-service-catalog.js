// Seed the service-request catalog (AV + HOUSEKEEPING). Idempotent: upserts by (department, name).
//
// DATABASE_URL must come from the environment; there is no default. For the local dev DB:
//   npx dotenv -e .env.development.local -- node scripts/seed-service-catalog.js
const { PrismaClient } = require("@prisma/client");

const CATALOG = {
  AV: [
    ["Laptop", true],
    ["Projector", true],
    ["LCD TV", true],
    ["Microphone", true],
    ["Manpower", false],
    ["โต๊ะเก้าอี้", false],
  ],
  HOUSEKEEPING: [
    ["โพเดียม", true],
    ["โต๊ะจีน", true],
    ["เก้าอี้ใหญ่", true],
    ["เก้าอี้กลาง", true],
    ["รถไฟฟ้า", true],
    ["ช่างโยธา", false],
    ["แม่บ้าน", false],
  ],
};

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  console.log(`target DB: ${process.env.DATABASE_URL.replace(/:[^:@/]*@/, ":***@")}`);
  for (const [department, items] of Object.entries(CATALOG)) {
    for (const [i, [name, returnable]] of items.entries()) {
      await prisma.serviceCatalogItem.upsert({
        where: { department_name: { department, name } },
        update: { returnable, sortOrder: i },
        create: { department, name, returnable, sortOrder: i },
      });
    }
  }
  console.log(`catalog rows: ${await prisma.serviceCatalogItem.count()}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
