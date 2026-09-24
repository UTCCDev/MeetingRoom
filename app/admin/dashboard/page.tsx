"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import { SkeletonCards } from "@/app/components/Skeleton";
import { roomLocation, STATUS_BADGE, STATUS_ICONS, STATUS_LABELS } from "@/lib/format";

interface DashboardStats {
  totalRooms: number;
  totalUsers: number;
  totalBookings: number;
  pendingBookings: number;
  approvedBookings: number;
  roomUtilization: Array<{
    roomId: string;
    roomName: string;
    roomDescription?: string | null;
    bookingCount: number;
  }>;
  bookingsByStatus: Record<string, number>;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "SYSTEM_ADMIN") {
        router.push("/");
      } else {
        fetchStats();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchStats = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dashboard-stats");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setStats(data);
    } catch (err) {
      console.error("Dashboard stats failed:", err);
      setError("ไม่สามารถโหลดสถิติแดชบอร์ดได้");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader title="แดชบอร์ดระบบ" breadcrumbs={[{ label: "แดชบอร์ด" }]} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {isLoading ? (
            <SkeletonCards count={3} className="grid grid-cols-1 md:grid-cols-3 gap-5" />
          ) : (
            <div className="card empty-state" role="alert">
              <span className="icon icon--40 icon--w300 icon--error" aria-hidden="true">error</span>
              <p>{error || "ไม่สามารถโหลดสถิติได้"}</p>
              <button type="button" onClick={fetchStats} className="btn-primary">
                <span className="icon icon--20 icon--w500" aria-hidden="true">refresh</span>
                ลองใหม่
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const STAT_TILES = [
    { icon: "domain", label: "ห้องทั้งหมด", value: stats.totalRooms, card: "" },
    { icon: "group", label: "ผู้ใช้ทั้งหมด", value: stats.totalUsers, card: "" },
    { icon: "event_note", label: "การจองทั้งหมด", value: stats.totalBookings, card: "" },
    // Status tiles are semantic cards: one on-* colour for icon and text.
    { icon: STATUS_ICONS.PENDING, label: "รอการตัดสินใจ", value: stats.pendingBookings, card: "card--warning" },
    { icon: STATUS_ICONS.APPROVED, label: "อนุมัติแล้ว", value: stats.approvedBookings, card: "card--success" },
  ];
  const maxRoomBookings = Math.max(...stats.roomUtilization.map((r) => r.bookingCount), 1);

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="แดชบอร์ดระบบ" breadcrumbs={[{ label: "แดชบอร์ด" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {STAT_TILES.map((t) => (
            <div key={t.label} className={`card flex flex-col gap-3 ${t.card}`} role={t.card ? "status" : undefined}>
              {t.card ? (
                <span className="inline-flex items-center h-10" aria-hidden="true">
                  <span className="icon icon--32 icon--w500">{t.icon}</span>
                </span>
              ) : (
                <span className="icon-tile bg-primary-container text-on-primary-container" aria-hidden="true">
                  <span className="icon icon--24 icon--w500">{t.icon}</span>
                </span>
              )}
              <div>
                <p className={`text-body-small ${t.card ? "" : "text-ink-subtle"}`}>{t.label}</p>
                <p className={`text-headline-medium tabular-nums ${t.card ? "" : "text-ink"}`}>{t.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bookings by Status */}
          <section className="card">
            <h2 className="flex items-center gap-2 text-title-large text-ink mb-5">
              <span className="icon icon--24 icon--w500 text-primary" aria-hidden="true">donut_small</span>
              การจองตามสถานะ
            </h2>
            <ul className="divide-y divide-line">
              {Object.entries(stats.bookingsByStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between items-center py-3">
                  <span className={STATUS_BADGE[status] || "badge-neutral"}>
                    <span className="icon icon--20 icon--w500" aria-hidden="true">{STATUS_ICONS[status] || "info"}</span>
                    {STATUS_LABELS[status] || status}
                  </span>
                  <span className="text-title-large text-ink tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Room Utilization */}
          <section className="card">
            <h2 className="flex items-center gap-2 text-title-large text-ink mb-1">
              <span className="icon icon--24 icon--w500 text-primary" aria-hidden="true">bar_chart</span>
              การใช้ห้อง
            </h2>
            <p className="text-body-small text-ink-subtle mb-5">จำนวนการจองที่อนุมัติแล้ว เรียงจากมากไปน้อย</p>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {stats.roomUtilization.length === 0 ? (
                <p className="empty-state py-8 text-body-small">ยังไม่มีห้องที่มีการจอง</p>
              ) : (
                stats.roomUtilization.map((room) => (
                  <div key={room.roomId}>
                    <div className="flex justify-between items-baseline gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-label-large text-ink truncate">{room.roomName}</p>
                        {room.roomDescription && (
                          <p className="text-body-small text-ink-subtle truncate">
                            {roomLocation(room.roomDescription)}
                          </p>
                        )}
                      </div>
                      <span className="text-label-large text-ink tabular-nums whitespace-nowrap">
                        {room.bookingCount} <span className="font-normal text-ink-subtle">ครั้ง</span>
                      </span>
                    </div>
                    <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(room.bookingCount / maxRoomBookings) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { href: "/admin/users", icon: "group", title: "จัดการผู้ใช้", body: "สร้างและจัดการบัญชีผู้ใช้" },
            { href: "/admin/rooms", icon: "domain", title: "จัดการห้อง", body: "สร้างและจัดการห้องประชุม" },
            { href: "/admin/pending-approvals", icon: "fact_check", title: "ตรวจสอบการจอง", body: "อนุมัติหรือปฏิเสธการจองที่รอการตัดสินใจ" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="card card--interactive group flex items-center gap-4">
              <span
                className="icon-tile bg-primary-container text-on-primary-container"
                aria-hidden="true"
              >
                <span className="icon icon--24 icon--w500">{a.icon}</span>
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="card__title">{a.title}</h3>
                <p className="card__body">{a.body}</p>
              </div>
              <span
                className="icon icon--24 icon--w300 text-ink-subtle transition-transform group-hover:translate-x-1 group-hover:text-primary"
                aria-hidden="true"
              >
                arrow_forward
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
