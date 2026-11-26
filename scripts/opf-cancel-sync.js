// Cancel imported กองอาคาร bookings that the backup marks as cancelled (Remark "ยกเลิกโดย ...").
//   python scripts/opf-bak-cancelled.py <backup.xlsx>
//   node scripts/opf-cancel-sync.js            -> dry run
//   node scripts/opf-cancel-sync.js --commit   -> set CANCELLED
// Matches by the [OPF#<id>@...] marker the importers put in the description. Only imported rows are touched.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const FILE = path.join(__dirname, "..", "old", "opf", "opf-bak-cancelled.json");
const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();
const show = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

async function main() {
  console.log(`target DB: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]*@/, ":***@")}`);
  const cancelled = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const byId = new Map(cancelled.map((c) => [c.id, c]));
  const rows = await prisma.booking.findMany({
    where: { description: { contains: "[OPF#" } },
    select: { id: true, title: true, status: true, startTime: true, description: true, room: { select: { code: true } } },
  });
  const hits = rows.filter((b) => byId.has(b.description.match(/\[OPF#([^@\]]+)@/)?.[1]));
  const todo = hits.filter((b) => b.status === "PENDING" || b.status === "APPROVED");
  console.log(`cancelled in backup: ${cancelled.length}, found in DB: ${hits.length}, already cancelled: ${hits.length - todo.length}, to cancel: ${todo.length}`);
  const now = new Date();
  for (const b of todo) {
    const c = byId.get(b.description.match(/\[OPF#([^@\]]+)@/)[1]);
    console.log(` ${b.startTime > now ? "future" : "past  "} ${b.room.code} ${show(b.startTime)} "${b.title}" (ยกเลิกโดย ${c.cancelledBy} ${c.cancelledAt})`);
  }
  if (!commit) return console.log("\nDry run only. Re-run with --commit to apply.");
  const { count } = await prisma.booking.updateMany({
    where: { id: { in: todo.map((b) => b.id) }, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "CANCELLED" },
  });
  console.log("cancelled:", count);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
