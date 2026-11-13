// Import legacy bookings from the old สำนักอำนวยการ system (old/oa/oa-bookings.json,
// built from old/oa/bookings-schema.xlsx: APPROVED only, อาคาร 24 ชั้น 15 rooms M241501-M241504).
//
//   node scripts/import-oa.js            -> dry run (no writes), prints a report
//   node scripts/import-oa.js --commit   -> insert new bookings, refresh description of imported ones
//
// All bookings are owned and approved by OWNER_EMAIL for now (re-assign users later); the legacy
// booker (ผู้ขอใช้ / สำหรับ / โทร / ผู้เข้าร่วม) is written into description.
// Re-running is safe: a row is "already imported" when OWNER_EMAIL has a booking in the same room with
// the same start, end and title (or the old "[OA#<docno>]" marker); those only get description refreshed.
// No Microsoft Graph sync is done here (graphEventId stays null).
//
// Always pass DATABASE_URL explicitly for the target DB, e.g.
//   DATABASE_URL="mysql://user:pass@host:3306/db_meetingroom" node scripts/import-oa.js
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const OWNER_EMAIL = process.env.OWNER_EMAIL || "system@example.com";
const FILE = path.join(__dirname, "..", "old", "oa", "oa-bookings.json");
const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();

// Legacy times are Bangkok local time.
const bkk = (s) => new Date(s.replace(" ", "T") + "+07:00");
const keyOf = (roomId, start, end, title) => `${roomId}|${start.getTime()}|${end.getTime()}|${title}`;

async function main() {
  const rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
  console.log(`target DB: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]*@/, ":***@")}`);
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found`);

  const codes = [...new Set(rows.map((r) => r.room_code))];
  const rooms = await prisma.room.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const roomByCode = Object.fromEntries(rooms.map((r) => [r.code, r]));
  const missing = codes.filter((c) => !roomByCode[c]);
  if (missing.length) throw new Error(`rooms not found: ${missing.join(", ")}`);

  const existing = await prisma.booking.findMany({
    where: { roomId: { in: rooms.map((r) => r.id) } },
    select: { id: true, userId: true, roomId: true, title: true, description: true, startTime: true, endTime: true, status: true },
  });
  const byMarker = {};
  const byKey = {};
  for (const b of existing) {
    const m = (b.description || "").match(/\[OA#([^\]]+)\]/);
    if (m) byMarker[m[1]] = b;
    if (b.userId === owner.id) byKey[keyOf(b.roomId, b.startTime, b.endTime, b.title)] = b;
  }
  const live = existing.filter((b) => b.status === "PENDING" || b.status === "APPROVED");

  const data = [];
  const updates = [];
  const conflicts = [];
  let unchanged = 0;
  for (const r of rows) {
    const room = roomByCode[r.room_code];
    const startTime = bkk(r.startTime);
    const endTime = bkk(r.endTime);
    const description = r.description || null;
    const prev = byMarker[r.docno] || byKey[keyOf(room.id, startTime, endTime, r.title)];
    if (prev) {
      if (prev.description !== description) updates.push({ id: prev.id, description });
      else unchanged++;
      continue;
    }
    const clash = live.find((b) => b.roomId === room.id && b.startTime < endTime && b.endTime > startTime);
    if (clash) {
      conflicts.push(`${r.docno} ${r.room_code} ${r.startTime} "${r.title}" ชนกับ booking ${clash.id} "${clash.title}"`);
      continue;
    }
    data.push({
      userId: owner.id,
      roomId: room.id,
      title: r.title,
      description,
      attendees: r.attendees || 0,
      startTime,
      endTime,
      status: "APPROVED",
      approvedById: owner.id,
      autoApproved: true,
      decisionNote: r.decisionNote || null,
      createdAt: r.createdAt ? bkk(r.createdAt) : undefined,
    });
  }

  console.log(`rows in file: ${rows.length}`);
  console.log(`already imported, unchanged: ${unchanged}`);
  console.log(`already imported, description to refresh: ${updates.length}`);
  console.log(`conflicts with existing bookings (not imported): ${conflicts.length}`);
  conflicts.forEach((c) => console.log("  - " + c));
  const perRoom = {};
  data.forEach((d) => { const c = rooms.find((r) => r.id === d.roomId).code; perRoom[c] = (perRoom[c] || 0) + 1; });
  console.log(`to insert: ${data.length}`, perRoom);

  if (!commit) { console.log("\nDRY RUN - nothing written. Re-run with --commit to apply."); return; }
  for (const u of updates) await prisma.booking.update({ where: { id: u.id }, data: { description: u.description } });
  const res = data.length ? await prisma.booking.createMany({ data }) : { count: 0 };
  console.log(`updated: ${updates.length}, inserted: ${res.count}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
