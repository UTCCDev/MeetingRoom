import { prisma } from "@/lib/prisma";
import { sendServiceEmail } from "@/lib/email";
import { formatDate, formatTime } from "@/lib/format";
import { DEPT_LABEL, type Dept } from "@/lib/service-rules";

// Email hooks for service requests. Every function catches internally and never throws:
// a failed email is logged and must never undo the DB change that triggered it.

const SEGMENT: Record<Dept, string> = { AV: "av", HOUSEKEEPING: "housekeeping" };
type Person = { id: string; name: string; email: string };

const base = () => (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");

async function load(id: string) {
  return prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      booking: { select: { room: { select: { name: true } } } },
      items: { include: { catalogItem: { select: { name: true, returnable: true } } } },
    },
  });
}
type Req = NonNullable<Awaited<ReturnType<typeof load>>>;

async function adminEmails(dept: Dept): Promise<Person[]> {
  const rows = await prisma.serviceMember.findMany({
    where: { department: dept, role: "ADMIN", user: { active: true } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((m) => m.user);
}

function details(r: Req): string[] {
  const start = r.startTime;
  const items = r.items.map((i) => `${i.catalogItem?.name ?? i.otherText ?? "อื่น ๆ"} x${i.qty}`).join(", ");
  const where = r.location ?? r.booking?.room.name;
  return [
    `แผนก: ${DEPT_LABEL[r.department as Dept]}`,
    `ผู้ขอ: ${r.requester.name}`,
    ...(where ? [`สถานที่: ${where}`] : []),
    `เวลา: ${formatDate(start)} ${formatTime(start)}–${formatTime(r.endTime)} น.`,
    `รายการ: ${items}`,
  ];
}

const emails = (people: Array<Person | null | undefined>) => [...new Set(people.filter((p): p is Person => !!p).map((p) => p.email).filter(Boolean))];

async function run(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error(`Service notify (${label}) failed:`, err);
  }
}

export const notifyNewRequest = (id: string): Promise<void> =>
  run("new", async () => {
    const r = await load(id);
    if (!r || !r.visibleAt) return;
    const dept = r.department as Dept;
    await sendServiceEmail(
      emails(await adminEmails(dept)),
      `คำร้องขอบริการใหม่ (${DEPT_LABEL[dept]})`,
      details(r),
      `${base()}/services/${SEGMENT[dept]}`,
    );
  });

export const notifyDecision = (id: string): Promise<void> =>
  run("decision", async () => {
    const r = await load(id);
    if (!r) return;
    const dept = r.department as Dept;
    const label = DEPT_LABEL[dept];
    const lines = details(r);
    let subject: string;
    if (r.status === "ACCEPTED") subject = `${label}รับคำร้องขอบริการของคุณแล้ว`;
    else if (r.status === "REJECTED") {
      subject = `คำร้องขอบริการของคุณถูกปฏิเสธ (${label})`;
      if (r.rejectionReason) lines.push(`เหตุผลการปฏิเสธ: ${r.rejectionReason}`);
    } else if (r.status === "DONE") subject = `งานบริการของคุณเสร็จสิ้น (${label})`;
    else return;
    await sendServiceEmail(emails([r.requester]), subject, lines, `${base()}/services/mine`);
  });

export const notifyAssigned = (id: string): Promise<void> =>
  run("assigned", async () => {
    const r = await load(id);
    if (!r || !r.assignee) return;
    const dept = r.department as Dept;
    await sendServiceEmail(
      emails([r.assignee]),
      `คุณได้รับมอบหมายงานบริการ (${DEPT_LABEL[dept]})`,
      details(r),
      `${base()}/services/${SEGMENT[dept]}/assigned`,
    );
  });

export const notifyCancelled = (id: string): Promise<void> =>
  run("cancelled", async () => {
    const r = await load(id);
    if (!r || !r.visibleAt) return; // the department never saw a hidden request
    const dept = r.department as Dept;
    await sendServiceEmail(
      emails([...(await adminEmails(dept)), r.assignee]),
      `คำร้องขอบริการถูกยกเลิก (${DEPT_LABEL[dept]})`,
      details(r),
      `${base()}/services/${SEGMENT[dept]}`,
    );
  });
