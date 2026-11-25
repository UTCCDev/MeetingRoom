// Push approved, upcoming bookings that have no Outlook event (e.g. legacy rows inserted straight into the DB)
// to the room mailbox calendar, the same way approval does in the app.
//   node scripts/sync-room-calendar.js                 -> dry run
//   node scripts/sync-room-calendar.js --commit        -> create events, save graphEventId
//   --rooms=M241501,M241502  limit to these room codes (default: สำนักอำนวยการ rooms)
// Needs DATABASE_URL and AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET / AZURE_AD_TENANT_ID.
const { PrismaClient } = require("@prisma/client");

const roomsArg = process.argv.find((a) => a.startsWith("--rooms="));
const ROOMS = roomsArg ? roomsArg.slice(8).split(",") : ["M241501", "M241502", "M241503", "M241504", "M241601"];
const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const gTime = (d) => ({ dateTime: d.toISOString().replace("Z", ""), timeZone: "UTC" });
const bkk = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

async function token() {
  const { AZURE_AD_CLIENT_ID: id, AZURE_AD_CLIENT_SECRET: secret, AZURE_AD_TENANT_ID: tenant } = process.env;
  if (!id || !secret || !tenant) throw new Error("AZURE_AD_* not set");
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`token ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  const rows = await prisma.booking.findMany({
    where: { status: "APPROVED", graphEventId: null, endTime: { gt: new Date() }, room: { code: { in: ROOMS } } },
    include: { room: true, user: { select: { name: true, email: true } }, department: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  const noMailbox = rows.filter((b) => !b.room.calendarEmail);
  const todo = rows.filter((b) => b.room.calendarEmail);
  const per = {};
  for (const b of todo) per[`${b.room.code} -> ${b.room.calendarEmail}`] = (per[`${b.room.code} -> ${b.room.calendarEmail}`] || 0) + 1;
  console.log("to sync:", todo.length, per);
  if (noMailbox.length) console.log("skipped, room has no calendarEmail:", [...new Set(noMailbox.map((b) => b.room.code))]);
  if (!commit) {
    for (const b of todo.slice(0, 5)) console.log(" ", b.room.code, bkk(b.startTime), b.title, "·", b.department?.name || b.user.name);
    return console.log("dry run; add --commit");
  }

  const t = await token();
  // Skip bookings that overlap any event already in the room calendar (e.g. created directly in Outlook).
  const existing = {};
  for (const mb of new Set(todo.map((b) => b.room.calendarEmail))) {
    existing[mb] = [];
    let url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mb)}/calendarView?startDateTime=${new Date().toISOString()}&endDateTime=2030-01-01T00:00:00Z&$select=subject,start,end&$top=500`;
    while (url) {
      const j = await (await fetch(url, { headers: { Authorization: `Bearer ${t}`, Prefer: 'outlook.timezone="UTC"' } })).json();
      if (j.error) throw new Error(`${mb}: ${j.error.code}`);
      existing[mb].push(...j.value);
      url = j["@odata.nextLink"];
    }
  }
  let ok = 0, fail = 0, skipped = 0;
  for (const b of todo) {
    const clash = existing[b.room.calendarEmail].find((e) => new Date(e.start.dateTime + "Z") < b.endTime && new Date(e.end.dateTime + "Z") > b.startTime);
    if (clash) { skipped++; console.log("SKIP", b.room.code, bkk(b.startTime), b.title, "<->", clash.subject); continue; }
    // Legacy rows belong to a system account, so show the department instead of its name.
    const who = b.user.email === "system@example.com" ? b.department?.name || "ระบบเดิม" : b.user.name;
    const lines = [`ผู้จอง: ${who}`, `จำนวนผู้เข้าร่วม: ${b.attendees} คน`, b.description ? `รายละเอียด: ${b.description}` : ""].filter(Boolean);
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(b.room.calendarEmail)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: `${b.title} · ${who}`,
        body: { contentType: "HTML", content: lines.map(esc).join("<br>").replace(/\n/g, "<br>") },
        start: gTime(b.startTime),
        end: gTime(b.endTime),
        location: { displayName: `${b.room.code} (${b.room.name})` },
        showAs: "busy",
        isReminderOn: false,
        transactionId: `meetingroom-${b.id}`,
      }),
    });
    if (!res.ok) { fail++; console.log("FAIL", b.id, res.status, (await res.text()).slice(0, 200)); continue; }
    const ev = await res.json();
    await prisma.booking.update({ where: { id: b.id }, data: { graphEventId: ev.id } });
    ok++;
  }
  console.log("created:", ok, "skipped:", skipped, "failed:", fail);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
