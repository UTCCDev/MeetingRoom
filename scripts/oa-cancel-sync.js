// Cancel bookings that were imported from the old สำนักอำนวยการ system and later cancelled there.
// Input: old/oa/oa-cancelled-<date>.json from `python scripts/oa-csv-build.py <csv> <json> --status=4`.
//
//   node scripts/oa-cancel-sync.js --file=old/oa/oa-cancelled-20261123.json            -> dry run
//   node scripts/oa-cancel-sync.js --file=old/oa/oa-cancelled-20261123.json --commit   -> cancel
//
// A row matches an imported booking by OWNER_EMAIL + room + start + end + title (same key as import-oa.js).
// The newer change wins: cancel only when the old system's last edit (updatedAt in the JSON) is later than
// the booking's updatedAt here; otherwise the booking was changed in the new system afterwards and is kept.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const OWNER_EMAIL = process.env.OWNER_EMAIL || "system@example.com";
const fileArg = process.argv.find((a) => a.startsWith("--file="));
if (!fileArg) throw new Error("--file=<json> is required");
const FILE = path.resolve(fileArg.slice(7));
const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();
const bkk = (s) => new Date(s.replace(" ", "T") + "+07:00");

async function main() {
  const rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
  console.log(`target DB: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]*@/, ":***@")}`);
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found`);
  const rooms = await prisma.room.findMany({ where: { code: { in: [...new Set(rows.map((r) => r.room_code))] } }, select: { id: true, code: true } });
  const roomByCode = Object.fromEntries(rooms.map((r) => [r.code, r]));

  const toCancel = [];
  const kept = [];
  let notFound = 0;
  for (const r of rows) {
    const room = roomByCode[r.room_code];
    if (!room) { notFound++; continue; }
    const b = await prisma.booking.findFirst({
      where: { userId: owner.id, roomId: room.id, startTime: bkk(r.startTime), endTime: bkk(r.endTime), title: r.title, status: { in: ["PENDING", "APPROVED"] } },
      select: { id: true, updatedAt: true, graphEventId: true },
    });
    if (!b) { notFound++; continue; }
    const line = `${r.docno} ${r.room_code} ${r.startTime} "${r.title}" (old edit ${r.updatedAt}, here ${b.updatedAt.toISOString()})`;
    if (bkk(r.updatedAt) > b.updatedAt) toCancel.push({ id: b.id, line, graph: !!b.graphEventId });
    else kept.push(line);
  }

  console.log(`cancelled rows in file: ${rows.length}, not imported here: ${notFound}`);
  console.log(`kept (changed here after the old cancel): ${kept.length}`);
  kept.forEach((l) => console.log("  = " + l));
  console.log(`to cancel: ${toCancel.length}`);
  toCancel.forEach((c) => console.log(`  x ${c.line}${c.graph ? " [has Outlook event - remove by hand]" : ""}`));
  if (!commit) { console.log("\nDRY RUN - nothing written. Re-run with --commit to apply."); return; }
  const res = await prisma.booking.updateMany({ where: { id: { in: toCancel.map((c) => c.id) } }, data: { status: "CANCELLED" } });
  console.log(`cancelled: ${res.count}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
