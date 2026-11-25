// One-off (23 Nov 2026): reject new-system bookings that clash with older, still-approved bookings
// from the old สำนักอำนวยการ system (the old one was booked first), and remove their room Outlook events.
//   node scripts/reject-legacy-conflicts.js            -> dry run
//   node scripts/reject-legacy-conflicts.js --commit   -> reject + delete Outlook events
// Needs DATABASE_URL and AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET / AZURE_AD_TENANT_ID.
// No email is sent; tell the bookers directly.
const { PrismaClient } = require("@prisma/client");

const REJECT = {
  cmwsmwi6j1582484io3i0v39ml2: "REV69110122 ประชุมคณะกรรมการตัดสินคลิปวิดีโอ CPEXTRA (จอง 18 พ.ย. 2569)",
  cmwsqdk13250144irrx37qynhy: "REV69110099 เปิดซอง กลุ่ม 3 พัสดุทั่วไป (จอง 13 พ.ย. 2569)",
  cmwsnueie1733094io359cjp4z0: "REV69110104 ประชุมวิชาการ (จอง 16 พ.ย. 2569)",
};
const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();

async function graphToken() {
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
  const token = commit ? await graphToken() : null;
  for (const [id, legacy] of Object.entries(REJECT)) {
    const b = await prisma.booking.findUnique({ where: { id }, include: { room: { select: { code: true, calendarEmail: true } }, user: { select: { name: true } } } });
    if (!b) { console.log(`- ${id} not found`); continue; }
    console.log(`${b.room.code} ${b.startTime.toISOString()} "${b.title}" (${b.user.name}) status=${b.status} outlook=${!!b.graphEventId}`);
    if (!commit || !["PENDING", "APPROVED"].includes(b.status)) continue;
    await prisma.booking.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: `เวลาชนกับการจองในระบบเดิมที่จองไว้ก่อน: ${legacy}`, graphEventId: null },
    });
    if (b.graphEventId && b.room.calendarEmail) {
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(b.room.calendarEmail)}/events/${encodeURIComponent(b.graphEventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`   rejected; outlook delete ${res.status}${res.ok || res.status === 404 ? "" : " " + (await res.text())}`);
    } else console.log("   rejected");
  }
  if (!commit) console.log("\nDRY RUN - nothing written. Re-run with --commit to apply.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
