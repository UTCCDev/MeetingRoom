import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import Phrases from "@/app/components/Phrases";
import QuickSearch from "@/app/components/QuickSearch";
import { prisma } from "@/lib/prisma";
import { roomCover } from "@/lib/room-photos";
import { addDays, bangkokISO, formatDate, formatRange, formatTime, roomLabel, todayKey } from "@/lib/format";

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
          <span className="icon icon--24">{t.icon}</span>
        </span>
        <div className="min-w-0">
          <span className={`block text-title-small ${warning ? "" : "text-primary"}`}>{t.overline}</span>
          <h3 className={`text-title-large mt-1 ${warning ? "" : "text-ink"}`}>
            <Phrases text={t.title} />
          </h3>
          <p className={`text-body-medium mt-1 ${warning ? "" : "text-ink-muted"}`}>
            <Phrases text={t.description} />
          </p>
          {t.meta && <p className={`mt-3 text-title-medium ${warning ? "" : "text-ink"}`}>{t.meta}</p>}
          {t.details && (
            <ul className={`mt-3 space-y-2 ${warning ? "" : "text-ink-muted"}`}>
              {t.details.map((d) => (
                <li key={d.icon} className="icon-lead gap-2 text-body-large leading-[1.4]">
                  <span className={`icon icon--20 ${warning ? "" : "text-primary"}`} aria-hidden="true">{d.icon}</span>
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
        className={`px-4 sm:px-6 h-12 flex items-center justify-between border-t text-title-small ${
          warning ? "border-highlight-90" : "card__footer text-primary"
        }`}
      >
        {t.action}
        <span className="icon icon--20 transition-transform duration-100 group-hover:translate-x-1" aria-hidden="true">
          arrow_forward
        </span>
      </span>
    </Link>
  );
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return <PublicLanding />;
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

      <main className="flex-1 w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-8 sm:pb-12">
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
              src="/room-photos/card-ushape.jpg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-[70%_50%] transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/30" aria-hidden="true" />
            <div className="relative flex flex-col justify-between gap-6 p-6 sm:p-8 max-w-xl">
              <div>
                <span className="block text-title-small text-highlight">จองห้องประชุม</span>
                <h3 className="text-headline-small text-on-primary mt-1">
                  <Phrases text="ค้นหาห้องที่ว่าง และจองได้ทันที" />
                </h3>
                <p className="text-body-medium text-primary-90 mt-2">
                  <Phrases text="เลือกวัน เวลา และจำนวนที่นั่ง ระบบจะแสดงเฉพาะห้องที่ว่างให้" />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 h-[52px] px-[34px] rounded-full bg-surface text-primary text-title-medium transition-colors group-hover:bg-primary-95">
                  <span className="icon icon--24" aria-hidden="true">search</span>
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
            <h2 id="home-admin" className="flex items-center gap-2 text-title-large text-ink mb-4">
              <span className="icon icon--24 text-primary" aria-hidden="true">admin_panel_settings</span>
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
    </div>
  );
}

// Guests see available rooms and their schedules without signing in; booking
// itself still requires an account (enforced on /rooms/[id] and /api/bookings).
//
// Order follows what a visitor needs: find a free room for a time (search) →
// what the system covers (facts) → how booking works (approval is required) →
// today's status of a few rooms → browse by building.

/** "อาคาร 24" from "หน่วยงาน - อาคาร 24 ชั้น 15". */
function buildingOf(description?: string | null): string | null {
  // Skip the unit segment: names like "กองอาคารและสิ่งแวดล้อม" contain "อาคาร" too.
  const place = (description || "").split(/\s+-\s+/).slice(1).join(" ");
  const m = place.match(/^(อาคาร\s*.+?)\s+ชั้น/);
  return m ? m[1].trim() : null;
}

/** Unit (หน่วยงาน) and where it is, split from the description. */
function splitLocation(description?: string | null): { unit: string; place: string } {
  const [unit = "", ...rest] = (description || "").split(/\s+-\s+/).map((s) => s.trim());
  return { unit, place: rest.join(" · ") };
}

const STEPS = [
  { icon: "travel_explore", title: "ค้นหาห้องที่ว่าง", text: "เลือกวัน เวลา และจำนวนคน ดูได้ทันที โดยไม่ต้องเข้าสู่ระบบ" },
  { icon: "edit_calendar", title: "ส่งคำขอจอง", text: "เข้าสู่ระบบ ด้วยบัญชีมหาวิทยาลัย แล้วระบุหัวข้อการประชุม" },
  { icon: "verified", title: "รอผู้ดูแลอนุมัติ", text: "ติดตามสถานะ ที่การจองของฉัน และรับแจ้งเตือน เมื่อมีผล" },
];

async function PublicLanding() {
  const today = todayKey();
  const dayStart = new Date(bangkokISO(today, "00:00"));
  const dayEnd = new Date(bangkokISO(addDays(today, 1), "00:00"));

  const [rooms, todayBookings] = await Promise.all([
    prisma.room.findMany({
      where: { status: true },
      select: { id: true, name: true, description: true, capacity: true, image: true },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
        room: { status: true },
      },
      select: { roomId: true, startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const bookedToday = new Map<string, string[]>();
  for (const b of todayBookings) {
    const list = bookedToday.get(b.roomId) || [];
    list.push(`${formatTime(b.startTime)}–${formatTime(b.endTime)}`);
    bookedToday.set(b.roomId, list);
  }

  const buildings = new Map<string, number>();
  for (const r of rooms) {
    const b = buildingOf(r.description);
    if (b) buildings.set(b, (buildings.get(b) || 0) + 1);
  }
  // Numbered buildings first, in number order; named ones after.
  const buildingList = [...buildings.entries()].sort(([a], [b]) => {
    const na = parseInt(a.replace(/\D/g, ""), 10);
    const nb = parseInt(b.replace(/\D/g, ""), 10);
    if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
    return (na || 0) - (nb || 0) || a.localeCompare(b, "th");
  });

  const capacities = rooms.map((r) => r.capacity);
  const minCap = capacities.length ? Math.min(...capacities) : 0;
  const maxCap = capacities.length ? Math.max(...capacities) : 0;
  const freeAllDay = rooms.filter((r) => !bookedToday.has(r.id)).length;

  // A spread of sizes, largest first: big rooms are the hardest to find.
  const featured = [...rooms].sort((a, b) => b.capacity - a.capacity || a.name.localeCompare(b.name, "th")).slice(0, 5);

  const stats = [
    { icon: "meeting_room", value: `${rooms.length}`, label: "ห้องเปิดให้จอง" },
    { icon: "event_available", value: `${freeAllDay}`, label: "ห้องว่างทั้งวัน วันนี้" },
    { icon: "domain", value: `${buildings.size}`, label: "อาคาร" },
    { icon: "groups", value: minCap === maxCap ? `${maxCap}` : `${minCap}–${maxCap}`, label: "ที่นั่งต่อห้อง" },
  ];

  const [hero, ...rest] = featured;

  return (
    <div className="min-h-screen flex flex-col bg-canvas overflow-x-clip">
      <AppHeader />

      <main className="flex-1 w-full">
        {/* ── 1 · Hero: brand panel + the one action a visitor came for ───────────── */}
        <section aria-labelledby="landing-title" className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <div className="rounded-lg bg-primary text-on-primary">
            <div className="px-6 sm:px-10 lg:px-14 pt-10 sm:pt-14 pb-24 sm:pb-28 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-[38rem]">
                <p className="text-title-small text-highlight">ระบบจองห้องประชุม UTCC</p>
                <h1
                  id="landing-title"
                  className="mt-4 text-headline-large sm:text-display-small lg:text-[4rem] font-bold leading-[1.12] text-on-primary"
                >
                  <Phrases text="หาห้องประชุมที่ว่าง แล้วจองได้ทันที" />
                </h1>
                <p className="mt-5 text-body-medium text-primary-90 max-w-[32rem]">
                  <Phrases text="ห้องประชุมทุกหน่วยงาน รวมไว้ในที่เดียว ดูวันเวลาว่างได้ โดยไม่ต้องเข้าสู่ระบบ" />
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-px rounded-md overflow-hidden bg-white/15 lg:w-[22rem]">
                {stats.map((st) => (
                  <div key={st.label} className="bg-primary px-5 py-4 flex flex-col-reverse">
                    <dt className="mt-2 text-body-small leading-[1.4] text-primary-90">
                      <Phrases text={st.label} />
                    </dt>
                    <dd className="text-headline-large font-bold text-on-primary tabular-nums leading-none">{st.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Search card overlaps the panel's bottom edge. */}
          <div className="relative z-10 -mt-14 sm:-mt-16 mx-2 sm:mx-6 lg:mx-10 rounded-lg bg-surface p-4 sm:p-6 shadow-[0_2px_4px_rgba(18,20,46,0.06),0_16px_40px_rgba(18,20,46,0.14)]">
            <p className="flex items-center gap-2 text-title-medium text-ink mb-4">
              <span className="icon icon--24 text-primary" aria-hidden="true">event_available</span>
              ต้องการห้องวันไหน เวลาอะไร
            </p>
            <QuickSearch />
          </div>
        </section>

        {/* ── 2 · How it works: approval is required — say so up front ───────────── */}
        <section aria-labelledby="landing-steps" className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-title-small text-primary">ขั้นตอนการจอง</span>
            <h2 id="landing-steps" className="text-headline-medium md:text-headline-large text-ink mt-1">
              <Phrases text="จองง่าย ใน 3 ขั้นตอน" />
            </h2>
          </div>
          <ol className="relative mt-10 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            {/* Dashed connector between the three badges. */}
            <span className="hidden md:block absolute top-9 left-[16.67%] right-[16.67%] border-t-2 border-dashed border-primary-80" aria-hidden="true" />
            {STEPS.map((st, i) => (
              <li key={st.title} className="relative text-center px-4">
                <span className="relative mx-auto flex w-[4.5rem] h-[4.5rem] items-center justify-center rounded-full bg-surface border border-line shadow-[0_8px_24px_rgba(46,49,146,0.12)] text-primary">
                  <span className="icon icon--32" aria-hidden="true">{st.icon}</span>
                  <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-highlight text-on-highlight text-label-large flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                </span>
                <h3 className="text-title-large text-ink mt-5">{st.title}</h3>
                <p className="text-body-small text-ink-muted mt-1 max-w-[18rem] mx-auto">
                  <Phrases text={st.text} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 3 · Bento gallery of the largest rooms, with today's status ─────────── */}
        {hero && (
          <section aria-labelledby="landing-rooms" className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <span className="text-title-small text-primary">ห้องขนาดใหญ่ · {formatDate(dayStart)}</span>
                <h2 id="landing-rooms" className="text-headline-medium md:text-headline-large text-ink mt-1">
                  <Phrases text="ห้องสำหรับงานใหญ่" />
                </h2>
              </div>
              <Link href="/rooms" className="btn-tonal">
                ดูห้องทั้งหมด {rooms.length} ห้อง
                <span className="icon icon--20" aria-hidden="true">arrow_forward</span>
              </Link>
            </div>

            <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible lg:h-[34rem]">
              {[hero, ...rest].map((room, i) => {
                const { unit, place } = splitLocation(room.description);
                const booked = bookedToday.get(room.id);
                const big = i === 0;
                return (
                  <li key={room.id} className={`w-[82%] shrink-0 snap-start sm:w-auto ${big ? "sm:col-span-2 lg:row-span-2" : ""}`}>
                    <Link
                      href={`/rooms/${room.id}`}
                      className={`group relative block h-full overflow-hidden rounded-md bg-primary text-on-primary ${big ? "min-h-[20rem]" : "min-h-[20rem] sm:min-h-[15rem]"}`}
                    >
                      <img
                        src={roomCover(room)}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-primary-10/95 via-primary-10/40 to-transparent" aria-hidden="true" />
                      <span
                        className={`absolute top-3 left-3 inline-flex items-center gap-1 rounded-full h-8 px-3 text-label-large ${
                          booked ? "bg-highlight-container text-on-highlight-container" : "bg-success-container text-on-success-container"
                        }`}
                      >
                        <span className="icon icon--20" aria-hidden="true">{booked ? "schedule" : "check_circle"}</span>
                        {booked ? `วันนี้มีจอง ${booked.length} ช่วง` : "ว่างทั้งวัน"}
                      </span>
                      <div className={`absolute inset-x-0 bottom-0 ${big ? "p-6 sm:p-8" : "p-4"}`}>
                        <span className="inline-flex items-center gap-1.5 text-title-small text-highlight">
                          <span className="icon icon--20" aria-hidden="true">group</span>
                          <span className="tabular-nums">{room.capacity}</span> ที่นั่ง
                        </span>
                        <h3 className={`${big ? "text-title-large sm:text-headline-medium" : "text-title-medium"} text-on-primary mt-1 line-clamp-2`}>
                          {unit || room.name}
                        </h3>
                        <p className={`text-body-small text-primary-90 ${big ? "" : "line-clamp-1"}`}>
                          <Phrases text={[unit ? room.name : "", place].filter(Boolean).join(" · ")} by="dot" />
                        </p>
                        {big && (
                          <span className="mt-4 inline-flex items-center gap-2 text-title-small text-on-primary">
                            ดูวันเวลาว่าง
                            <span className="icon icon--20 transition-transform group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── 4 · Browse by building ─────────────────────────────────────────────── */}
        {buildingList.length > 0 && (
          <section aria-labelledby="landing-buildings" className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
            <span className="text-title-small text-primary">{buildingList.length} อาคาร</span>
            <h2 id="landing-buildings" className="text-headline-medium md:text-headline-large text-ink mt-1 mb-6">
              <Phrases text="เลือกดูตามอาคาร" />
            </h2>
            <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2 sm:gap-3">
              {buildingList.map(([name, count]) => {
                const num = name.replace(/^อาคาร\s*/, "");
                const numeric = /^\d+$/.test(num);
                return (
                  <li key={name}>
                    <Link
                      href={`/rooms?q=${encodeURIComponent(`${name} ชั้น`)}`}
                      className="group flex h-full flex-col rounded-md border border-line bg-surface p-3 sm:p-4 transition-colors hover:border-primary hover:bg-primary-99"
                    >
                      <span className="text-label-medium text-ink-subtle">อาคาร</span>
                      {numeric ? (
                        <span className="text-headline-large sm:text-display-small text-primary tabular-nums leading-none mt-1 group-hover:text-primary-hover">{num}</span>
                      ) : (
                        <span className="text-title-medium text-primary mt-1 line-clamp-2">{num}</span>
                      )}
                      <span className="mt-auto pt-3 text-label-large text-ink-muted tabular-nums">{count} ห้อง</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── 5 · Closing call to action ─────────────────────────────────────────── */}
        <section className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="rounded-lg bg-primary text-on-primary">
            <div className="px-6 sm:px-10 lg:px-14 py-10 sm:py-14 max-w-xl">
              <h2 className="text-headline-medium md:text-headline-large text-on-primary">
                <Phrases text="พร้อมจองห้องแล้ว?" />
              </h2>
              <p className="text-body-medium text-primary-90 mt-2">
                <Phrases text="เข้าสู่ระบบ ด้วยบัญชีมหาวิทยาลัย เพื่อส่งคำขอจอง และติดตามสถานะ" />
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 h-[52px] px-[34px] rounded-full bg-surface text-primary text-title-medium hover:bg-primary-95 transition-colors"
                >
                  <span className="icon icon--24" aria-hidden="true">login</span>
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/rooms"
                  className="inline-flex items-center gap-2 h-[52px] px-[34px] rounded-full border border-white/50 text-on-primary text-title-medium hover:bg-white/10 transition-colors"
                >
                  ดูห้องทั้งหมด
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
