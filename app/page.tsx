import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";

interface Feature {
  href: string;
  icon: string; // Material Symbols name
  title: string;
  description: string;
  roles?: string[];
}

const FEATURES: Feature[] = [
  {
    href: "/rooms",
    icon: "meeting_room",
    title: "ค้นหาห้อง",
    description: "ดูรายชื่อห้องประชุมที่ว่างและจองห้องเพื่อการประชุมของคุณ",
  },
  {
    href: "/my-bookings",
    icon: "event_note",
    title: "การจองของฉัน",
    description: "ดูประวัติการจองและจัดการการจองของคุณ",
  },
  {
    href: "/admin/pending-approvals",
    icon: "fact_check",
    title: "อนุมัติการจอง",
    description: "ตรวจสอบและอนุมัติ/ปฏิเสธคำขอจองห้อง",
    roles: ["ROOM_ADMIN", "SYSTEM_ADMIN"],
  },
  {
    href: "/admin/my-rooms",
    icon: "edit_square",
    title: "จัดการห้องของฉัน",
    description: "แก้ไขข้อมูลห้องและจัดการรายละเอียด",
    roles: ["ROOM_ADMIN"],
  },
  {
    href: "/admin/dashboard",
    icon: "monitoring",
    title: "แดชบอร์ด",
    description: "ดูสถิติระบบและการใช้งาน",
    roles: ["SYSTEM_ADMIN"],
  },
  {
    href: "/admin/users",
    icon: "group",
    title: "จัดการผู้ใช้",
    description: "สร้างผู้ใช้และจัดการบทบาทสิทธิ์",
    roles: ["SYSTEM_ADMIN"],
  },
  {
    href: "/admin/rooms",
    icon: "domain",
    title: "จัดการห้องทั้งหมด",
    description: "จัดการห้องประชุมทั้งหมด",
    roles: ["SYSTEM_ADMIN"],
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  const userRole = (session.user as any)?.role;
  const features = FEATURES.filter((f) => !f.roles || f.roles.includes(userRole));

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <h1 className="text-headline-small md:text-headline-medium lg:text-headline-large text-ink mb-1">
            สวัสดี, {session.user?.name}
          </h1>
          <p className="text-body-medium text-ink-subtle">เลือกฟีเจอร์ที่ต้องการใช้งาน</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <Link key={f.href} href={f.href} className="card card--interactive group flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-m bg-primary-container text-primary">
                  <span className="icon icon--24 icon--w500" aria-hidden="true">
                    {f.icon}
                  </span>
                </span>
                <span
                  className="icon icon--24 icon--w300 text-ink-subtle transition-transform duration-100 group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
              </div>
              <div>
                <h2 className="card__title mb-1">{f.title}</h2>
                <p className="card__body">{f.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="py-8 border-t border-line bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-label-large text-ink">ระบบจองห้องประชุมรวมศูนย์</p>
          <p className="text-body-small text-ink-subtle mt-1">© {new Date().getFullYear()} - ทุกสิทธิ์สงวนไว้</p>
        </div>
      </footer>
    </div>
  );
}
