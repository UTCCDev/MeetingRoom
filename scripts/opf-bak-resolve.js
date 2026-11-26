// One-off (25 Nov 2026): make the DB follow the newer กองอาคาร backup (old/opf/opf-bak-bookings.json)
// where it disagrees with what the first import (11 Nov) left behind.
//
//   node scripts/opf-bak-resolve.js            -> dry run
//   node scripts/opf-bak-resolve.js --commit   -> apply
//
// 1. Misplaced rows: an imported booking whose OPF id is, in the backup, only in another room -> deleted
//    (the first import attached some ids to the wrong room).
// 2. Same title, same room and day but different time -> time taken from the backup.
// 3. Overlaps in the same room (the old system allowed double booking): the reservation made last in the
//    old system (createdAt = old reservation time) wins; losers that are in the DB are CANCELLED,
//    winners not yet in the DB are inserted (or re-approved if an earlier import cancelled them).
// Bookings made in the new system are never touched: if one is in the way, the backup row is skipped.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const OWNER_EMAIL = "admin20@utcc.ac.th";
const FILE = path.join(__dirname, "..", "old", "opf", "opf-bak-bookings.json");
const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();
const bkk = (s) => new Date(s.replace(" ", "T") + "+07:00");
const show = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const markerOf = (b) => (b.description || "").match(/\[OPF#[^\]]+\]/)?.[0];
const idOf = (m) => m?.match(/^\[OPF#(.+)@/)?.[1];
const overlaps = (a, b) => a.roomId === b.roomId && a.startTime < b.endTime && a.endTime > b.startTime;

async function main() {
  console.log(`target DB: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]*@/, ":***@")}`);
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  const rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const rooms = await prisma.room.findMany({ select: { id: true, code: true } });
  const roomId = Object.fromEntries(rooms.map((r) => [r.code, r.id]));
  const now = new Date();

  const bak = rows.map((r) => ({
    ...r, roomId: roomId[r.room_code], startTime: bkk(r.startTime), endTime: bkk(r.endTime),
    marker: `[OPF#${r.old_ReserveID}@${r.startTime}]`, createdAt: bkk(r.old_createDate.slice(0, 19)),
  })).filter((r) => r.endTime > now);
  const bakRoomsById = {};
  for (const r of bak) (bakRoomsById[String(r.old_ReserveID)] ??= new Set()).add(r.roomId);
  const bakRoomIds = new Set(bak.map((r) => r.roomId));

  const db = (await prisma.booking.findMany({
    where: { roomId: { in: [...bakRoomIds] }, endTime: { gt: now } },
    select: { id: true, roomId: true, title: true, description: true, startTime: true, endTime: true, status: true, createdAt: true },
  })).map((b) => ({ ...b, marker: markerOf(b) }));
  const code = Object.fromEntries(rooms.map((r) => [r.id, r.code]));
  const line = (x) => `${code[x.roomId]} ${show(x.startTime)}-${show(x.endTime).slice(11)} "${norm(x.title).slice(0, 45)}"`;

  // 1. misplaced
  const misplaced = db.filter((b) => {
    const rs = bakRoomsById[idOf(b.marker)];
    return b.status !== "CANCELLED" && rs && !rs.has(b.roomId);
  });
  const misplacedIds = new Set(misplaced.map((b) => b.id));
  let live = db.filter((b) => b.status !== "CANCELLED" && !misplacedIds.has(b.id));
  const liveMarkers = new Set(live.map((b) => b.marker).filter(Boolean));

  // 2 + 3: backup rows not live in the DB yet
  const retime = [], cancel = [], insert = [], reapprove = [], blocked = [];
  for (const r of bak.filter((r) => !liveMarkers.has(r.marker)).sort((a, b) => b.createdAt - a.createdAt)) {
    // Same-titled rows of the backup itself (the old system holds them side by side) don't count as clashes.
    const clashes = live.filter((b) => overlaps(b, r) && !(b.fromBak && norm(b.title) === norm(r.title)));
    // same event, other time (a row already in the DB)
    const same = clashes.find((b) => b.marker && b.description && norm(b.title) === norm(r.title) && b.startTime.toDateString() === r.startTime.toDateString());
    if (same) {
      if (same.startTime.getTime() !== r.startTime.getTime() || same.endTime.getTime() !== r.endTime.getTime()) {
        if (!retime.some((x) => x.b.id === same.id)) retime.push({ b: same, r });
      }
      continue;
    }
    if (clashes.some((b) => !b.marker)) { blocked.push(r); continue; } // booked in the new system
    if (clashes.some((b) => b.createdAt > r.createdAt)) continue; // a later old-system reservation wins
    for (const b of clashes) { cancel.push({ b, r }); live = live.filter((x) => x.id !== b.id); }
    const old = db.find((b) => b.marker === r.marker && b.status === "CANCELLED");
    if (old) reapprove.push({ b: old, r }); else insert.push(r);
    live.push({ ...r, id: old?.id ?? r.marker, title: r.title, fromBak: true });
  }

  console.log(`\n1. ลบ (ผูกผิดห้องตอน import รอบแรก): ${misplaced.length}`);
  misplaced.forEach((b) => console.log("   - " + line(b)));
  console.log(`\n2. แก้เวลาตามไฟล์ใหม่: ${retime.length}`);
  retime.forEach(({ b, r }) => console.log(`   - ${line(b)} -> ${show(r.startTime).slice(11)}-${show(r.endTime).slice(11)}`));
  console.log(`\n3a. ยกเลิก (มีการจองที่ใหม่กว่าในเวลาเดียวกัน): ${cancel.length}`);
  cancel.forEach(({ b, r }) => console.log(`   - ${line(b)}  แทนด้วย "${norm(r.title).slice(0, 45)}"`));
  console.log(`\n3b. เพิ่มใหม่: ${insert.length}`);
  insert.forEach((r) => console.log("   - " + line(r)));
  console.log(`\n3c. คืนสถานะอนุมัติ (เคยถูกยกเลิก): ${reapprove.length}`);
  reapprove.forEach(({ b }) => console.log("   - " + line(b)));
  console.log(`\nข้าม (ชนกับการจองที่ทำในระบบใหม่): ${blocked.length}`);
  blocked.forEach((r) => console.log("   - " + line(r)));

  if (!commit) { console.log("\nDry run only. Re-run with --commit to apply."); return; }
  // Array form: this Prisma version has no interactive transactions.
  const ops = [];
  if (misplaced.length) ops.push(prisma.booking.deleteMany({ where: { id: { in: misplaced.map((b) => b.id) } } }));
  for (const { b, r } of retime) {
    ops.push(prisma.booking.update({ where: { id: b.id }, data: { startTime: r.startTime, endTime: r.endTime, description: b.description.replace(b.marker, r.marker) } }));
  }
  for (const { b, r } of cancel) {
    ops.push(prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", rejectionReason: `ระบบเดิมมีการจองที่ใหม่กว่าในเวลาเดียวกัน: ${norm(r.title).slice(0, 120)}` } }));
  }
  for (const { b } of reapprove) {
    ops.push(prisma.booking.update({ where: { id: b.id }, data: { status: "APPROVED", approvedById: owner.id, autoApproved: true, rejectionReason: null } }));
  }
  if (insert.length) ops.push(prisma.booking.createMany({
    data: insert.map((r) => ({
      userId: owner.id, roomId: r.roomId, title: (r.title || "(ไม่มีชื่อ)").slice(0, 191),
      description: `${r.marker}\nนำเข้าจากระบบเดิม (กองอาคาร) ผู้จองเดิม: ${r["booked_by_name(old)"]}`,
      attendees: 1, startTime: r.startTime, endTime: r.endTime, status: "APPROVED",
      approvedById: owner.id, autoApproved: true, createdAt: r.createdAt,
    })),
  }));
  await prisma.$transaction(ops);
  console.log("\napplied.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
