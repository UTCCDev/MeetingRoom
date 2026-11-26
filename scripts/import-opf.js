// Import legacy bookings from the old กองอาคาร system (old/opf/opf-bookings.json,
// generated together with opf-migration-review-v2.xlsx).
//
//   node scripts/import-opf.js            -> dry run (no writes), prints a report
//   node scripts/import-opf.js --commit   -> insert bookings
//
// All bookings are owned by the กองอาคาร admin (OWNER_EMAIL). Re-running is safe:
// each row carries a marker "[OPF#<reserveId>@<start>]" in description and is skipped if present.
// If the DB has the booking-permissions columns, APPROVED rows get approvedById = owner and
// autoApproved = true; existing imported rows are backfilled the same way.
//
// Always pass DATABASE_URL explicitly for the target DB, e.g.
//   DATABASE_URL="mysql://user:pass@host:3306/db_meetingroom" node scripts/import-opf.js
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const OWNER_EMAIL = "admin20@utcc.ac.th";
// Optional: --file=<path> (e.g. old/opf/opf-bak-bookings.json from scripts/opf-bak-build.py)
const fileArg = process.argv.find((a) => a.startsWith("--file="));
const FILE = fileArg ? path.resolve(fileArg.slice(7)) : path.join(__dirname, "..", "old", "opf", "opf-bookings.json");
const commit = process.argv.includes("--commit");
// --skip-clashes: don't insert APPROVED rows that overlap a live booking in the same room (listed for review instead).
const skipClashes = process.argv.includes("--skip-clashes");
const prisma = new PrismaClient();

// Excel times are Bangkok local time.
const bkk = (s) => new Date(s.replace(" ", "T") + "+07:00");

async function main() {
  const rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found`);
  console.log(`target DB: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]*@/, ":***@")}`);

  const cols = (await prisma.$queryRawUnsafe("SHOW COLUMNS FROM bookings")).map((c) => c.Field);
  const hasApproval = cols.includes("approvedById") && cols.includes("autoApproved");
  console.log(`approval columns: ${hasApproval ? "yes (approvedById will be set)" : "no (old schema)"}`);

  const codes = [...new Set(rows.map((r) => r.room_code))];
  const rooms = await prisma.room.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const roomByCode = Object.fromEntries(rooms.map((r) => [r.code, r]));
  const missing = codes.filter((c) => !roomByCode[c]);
  if (missing.length) throw new Error(`rooms not found: ${missing.join(", ")}`);

  const existing = await prisma.booking.findMany({
    where: { roomId: { in: rooms.map((r) => r.id) } },
    select: { id: true, roomId: true, title: true, description: true, startTime: true, endTime: true, status: true },
  });
  const markers = new Set(existing.map((b) => (b.description || "").match(/\[OPF#[^\]]+\]/)?.[0]).filter(Boolean));
  // Old reservation ids already imported (any time slot), to catch reservations re-timed in the old system.
  const importedIds = new Set([...markers].map((m) => m.match(/^\[OPF#(.+)@/)?.[1]));
  const changed = [];
  const live = existing.filter((b) => b.status === "PENDING" || b.status === "APPROVED");

  const data = [];
  const conflicts = [];
  let skipped = 0;
  for (const r of rows) {
    const startTime = bkk(r.startTime);
    const endTime = bkk(r.endTime);
    const marker = `[OPF#${r.old_ReserveID}@${r.startTime}]`;
    if (markers.has(marker)) { skipped++; continue; }
    if (importedIds.has(String(r.old_ReserveID))) { changed.push(`${r.room_code} ${r.startTime} "${r.title}" (OPF#${r.old_ReserveID})`); continue; }
    const room = roomByCode[r.room_code];
    if (r.status === "APPROVED") {
      const clash = live.find((b) => b.roomId === room.id && b.startTime < endTime && b.endTime > startTime);
      if (clash) {
        conflicts.push(`${r.room_code} ${r.startTime} "${r.title}" ชนกับ booking ${clash.id} "${clash.title}"`);
        if (skipClashes) continue;
      }
    }
    const desc = [
      marker,
      `นำเข้าจากระบบเดิม (กองอาคาร) ผู้จองเดิม: ${r["booked_by_name(old)"]}`,
      r.old_remark || null,
    ].filter(Boolean).join("\n");
    data.push({
      userId: owner.id,
      roomId: room.id,
      title: (r.title || "(ไม่มีชื่อ)").slice(0, 191),
      description: desc,
      attendees: r.attendees || 1,
      startTime,
      endTime,
      status: r.status,
      ...(hasApproval && r.status === "APPROVED" ? { approvedById: owner.id, autoApproved: true } : {}),
      createdAt: r.old_createDate ? bkk(r.old_createDate.slice(0, 19)) : undefined,
    });
  }

  console.log(`rows in file: ${rows.length}`);
  console.log(`already imported (skipped): ${skipped}`);
  console.log(`to insert: ${data.length} (APPROVED ${data.filter((d) => d.status === "APPROVED").length}, CANCELLED ${data.filter((d) => d.status === "CANCELLED").length})`);
  console.log(`already imported with different time (skipped, check by hand): ${changed.length}`);
  changed.slice(0, 30).forEach((c) => console.log("  - " + c));
  console.log(`clashes with existing bookings in DB: ${conflicts.length}`);
  if (skipClashes) console.log(`  (--skip-clashes: these are NOT inserted)`);
  (skipClashes ? conflicts : conflicts.slice(0, 30)).forEach((c) => console.log("  - " + c));

  if (!commit) { console.log("\nDry run only. Re-run with --commit to insert."); return; }
  for (let i = 0; i < data.length; i += 500) {
    await prisma.booking.createMany({ data: data.slice(i, i + 500) });
  }
  console.log(`inserted ${data.length} bookings`);

  // Rows imported earlier (before the approval columns existed) get the approver filled in.
  if (hasApproval) {
    const { count } = await prisma.booking.updateMany({
      where: { description: { contains: "[OPF#" }, status: "APPROVED", approvedById: null },
      data: { approvedById: owner.id, autoApproved: true },
    });
    console.log(`backfilled approver on ${count} previously imported bookings`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
