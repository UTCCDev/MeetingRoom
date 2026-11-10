// Export rooms (code, name, capacity, admin email) to old/opf/rooms.json for scripts/opf-build.py.
//   DATABASE_URL="mysql://..." node scripts/opf-export-rooms.js
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

prisma.room
  .findMany({
    select: { id: true, code: true, name: true, description: true, capacity: true, roomType: true, roomAdmin: { select: { email: true } } },
  })
  .then((rooms) => {
    const out = path.join(__dirname, "..", "old", "opf", "rooms.json");
    fs.writeFileSync(out, JSON.stringify(rooms, null, 1));
    console.log(`wrote ${rooms.length} rooms to ${out}`);
  })
  .finally(() => prisma.$disconnect());
