import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import Phrases from "@/app/components/Phrases";
import { prisma } from "@/lib/prisma";
import { formatRange, roomLabel } from "@/lib/format";

type Tone = "default" | "warning";

interface Tile {
  href: string;
  icon: string; // Material Symbols name
  overline: string;
  title: string;
  description: string;
  meta?: string;
  details?: { icon: string; text: string }[]; // icon + text rows, e.g. the next meeting
  action: string;
  tone: Tone; // warning = semantic card when something needs attention
}

/* White outlined card (design.md › Cards): surface + line border, title ink, body ink-muted,
   overline primary, footer canvas, hover = primary border. When requests are waiting the
   approvals card switches to the semantic warning card (one on-* colour for all text). */
function TileCard({ t }: { t: Tile }) {
  const warning = t.tone === "warning";
  return (
    <Link
      href={t.href}
      className={`card card--interactive group p-0 sm:p-0 flex flex-col overflow-hidden ${warning ? "card--warning" : ""}`}
    >
      <div className="flex-1 flex gap-4 p-4 sm:p-6">
        <span
          className={`icon-tile ${warning ? "bg-surface" : "bg-primary-container text-on-primary-container"}`}
          aria-hidden="true"
        >
          <span className="icon icon--24 icon--w500">{t.icon}</span>
        </span>
        <div className="min-w-0">
          <span className={`block text-label-large ${warning ? "" : "text-primary"}`}>{t.overline}</span>
          <h3 className={`text-title-medium mt-0.5 ${warning ? "" : "text-ink"}`}>
            <Phrases text={t.title} />
          </h3>
          <p className={`text-body-medium leading-[1.6] mt-1 ${warning ? "" : "text-ink-muted"}`}>
            <Phrases text={t.description} />
          </p>
          {t.meta && <p className={`mt-3 text-title-small ${warning ? "" : "text-ink"}`}>{t.meta}</p>}
          {t.details && (
            <ul className={`mt-3 space-y-2 ${warning ? "" : "text-ink-muted"}`}>
              {t.details.map((d) => (
                <li key={d.icon} className="icon-lead gap-2 text-body-medium leading-[1.4]">
                  <span className={`icon icon--20 icon--w500 ${warning ? "" : "text-primary"}`} aria-hidden="true">{d.icon}</span>
                  <span className="min-w-0">
                    <Phrases text={d.text} by={d.text.includes(" · ") ? "dot" : "space"} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <span
        className={`px-4 sm:px-6 h-12 flex items-center justify-between border-t text-label-large ${
          warning ? "border-highlight-90" : "card__footer text-primary"
        }`}
      >
        {t.action}
        <span className="icon icon--20 icon--w500 transition-transform duration-100 group-hover:translate-x-1" aria-hidden="true">
          arrow_forward
        </span>
      </span>
    </Link>
  );
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  const me = (session.user as any).id as string;
  const role = (session.user as any)?.role as string;
  const isAdmin = role === "ROOM_ADMIN" || role === "SYSTEM_ADMIN";
  const now = new Date();

  const [activeRooms, upcoming, nextMeeting, pending, myRooms, users] = await Promise.all([
    prisma.room.count({ where: { status: true } }),
    prisma.booking.count({ where: { userId: me, status: { in: ["PENDING", "APPROVED"] }, endTime: { gt: now } } }),
    prisma.booking.findFirst({
      where: { userId: me, status: { in: ["PENDING", "APPROVED"] }, endTime: { gt: now } },
      orderBy: { startTime: "asc" },
      include: { room: { select: { name: true, description: true } } },
    }),
    isAdmin
      ? prisma.booking.count({
          where: {
            status: "PENDING",
            startTime: { gt: now },
            userId: { not: me },
            ...(role === "ROOM_ADMIN" ? { room: { roomAdminId: me } } : {}),
          },
        })
      : Promise.resolve(0),
    role === "ROOM_ADMIN" ? prisma.room.count({ where: { roomAdminId: me } }) : Promise.resolve(0),
    role === "SYSTEM_ADMIN" ? prisma.user.count({ where: { active: true } }) : Promise.resolve(0),
  ]);

  const bookingsTile: Tile = {
    href: "/my-bookings",
    icon: "event_note",
    overline: "การจองของฉัน",
    title: upcoming ? `กำลังจะมาถึง ${upcoming} รายการ` : "ยังไม่มีการประชุมที่จะมาถึง",
    description: nextMeeting ? `ถัดไป: ${nextMeeting.title}` : "ดูประวัติการจอง และติดตามสถานะคำขอของคุณ",
    details: nextMeeting
      ? [
          { icon: "schedule", text: formatRange(nextMeeting.startTime, nextMeeting.endTime) },
          { icon: "location_on", text: roomLabel(nextMeeting.room) },
          { icon: nextMeeting.status === "APPROVED" ? "check_circle" : "hourglass_top", text: nextMeeting.status === "APPROVED" ? "อนุมัติแล้ว" : "รอการอนุมัติ" },
        ]
      : undefined,
    action: "ดูการจองของฉัน",
    tone: "default",
  };

  const adminTiles: Tile[] = [
    {
      href: "/admin/pending-approvals",
      icon: pending ? "pending_actions" : "fact_check",
      overline: "อนุมัติการจอง",
      title: pending ? `รออนุมัติ ${pending} รายการ` : "ไม่มีคำขอค้าง",
      description: pending ? "ตรวจสอบและอนุมัติ/ปฏิเสธ ก่อนถึงเวลาประชุม" : "คำขอใหม่จะแจ้งเตือน ที่กระดิ่งด้านบน",
      action: pending ? "ตรวจสอบคำขอ" : "ดูหน้าอนุมัติ",
      tone: pending ? "warning" : "default",
    },
    ...(role === "ROOM_ADMIN"
      ? [
          {
            href: "/admin/my-rooms",
            icon: "edit_square",
            overline: "ห้องของฉัน",
            title: "จัดการห้องของฉัน",
            description: "แก้ไขข้อมูล รูป และสิ่งอำนวยความสะดวก ของห้อง",
            meta: `ดูแลอยู่ ${myRooms} ห้อง`,
            action: "จัดการห้อง",
            tone: "default" as Tone,
          },
        ]
      : []),
    ...(role === "SYSTEM_ADMIN"
      ? [
          {
            href: "/admin/dashboard",
            icon: "monitoring",
            overline: "ภาพรวม",
            title: "แดชบอร์ด",
            description: "สถิติการจอง และการใช้ห้อง",
            action: "เปิดแดชบอร์ด",
            tone: "default" as Tone,
          },
          {
            href: "/admin/users",
            icon: "group",
            overline: "ผู้ใช้",
            title: "จัดการผู้ใช้",
            description: "สร้างผู้ใช้ และกำหนดบทบาทสิทธิ์",
            meta: `ใช้งานอยู่ ${users} คน`,
            action: "จัดการผู้ใช้",
            tone: "default" as Tone,
          },
          {
            href: "/admin/rooms",
            icon: "domain",
            overline: "ห้องประชุม",
            title: "จัดการห้องทั้งหมด",
            description: "เพิ่ม แก้ไข และเปิด/ปิด การจองห้อง",
            meta: `เปิดให้จอง ${activeRooms} ห้อง`,
            action: "จัดการห้อง",
            tone: "default" as Tone,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <AppHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-8 sm:pb-12">
        <div>
          <h1 className="text-title-large md:text-headline-small text-ink">
            สวัสดี, {session.user?.name}
          </h1>
          <p className="text-body-medium text-ink-subtle">วันนี้ต้องการจองห้องประชุมหรือไม่</p>
        </div>


        <section aria-labelledby="home-booking" className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <h2 id="home-booking" className="sr-only">การจองห้อง</h2>

          {/* Overlay card (design.md › Cards): primary / on-primary, overline in highlight. */}
          <Link
            href="/rooms"
            className="group relative lg:col-span-2 min-h-[18rem] rounded-md overflow-hidden bg-primary text-on-primary flex"
          >
            <img
              src="/room-photos/board-1.jpg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/30" aria-hidden="true" />
            <div className="relative flex flex-col justify-between gap-6 p-6 sm:p-8 max-w-xl">
              <div>
                <span className="block text-label-large text-highlight">จองห้องประชุม</span>
                <h3 className="text-headline-small text-on-primary mt-1">
                  <Phrases text="ค้นหาห้องที่ว่าง และจองได้ทันที" />
                </h3>
                <p className="text-body-medium leading-[1.6] text-primary-90 mt-2">
                  <Phrases text="เลือกวัน เวลา และจำนวนที่นั่ง ระบบจะแสดงเฉพาะห้องที่ว่างให้" />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 h-[52px] px-[34px] rounded-full bg-surface text-primary text-title-small transition-colors group-hover:bg-primary-95">
                  <span className="icon icon--24 icon--w500" aria-hidden="true">search</span>
                  ค้นหาห้อง
                </span>
                <span className="text-body-small text-primary-90">
                  เปิดให้จอง <span className="font-bold text-on-primary tabular-nums">{activeRooms}</span> ห้อง
                </span>
              </div>
            </div>
          </Link>

          <TileCard t={bookingsTile} />
        </section>

        {isAdmin && (
          <section aria-labelledby="home-admin" className="mt-10">
            <h2 id="home-admin" className="flex items-center gap-2 text-title-medium text-ink mb-4">
              <span className="icon icon--24 icon--w500 text-primary" aria-hidden="true">admin_panel_settings</span>
              งานผู้ดูแล
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {adminTiles.map((t) => (
                <TileCard key={t.href} t={t} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="py-8 border-t border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-label-large text-ink">ระบบจองห้องประชุมรวมศูนย์</p>
          <p className="text-body-small text-ink-subtle mt-1">© {new Date().getFullYear()} - ทุกสิทธิ์สงวนไว้</p>
        </div>
      </footer>
    </div>
  );
}
