"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import { SkeletonCards } from "@/app/components/Skeleton";
import { roomLocation } from "@/lib/format";

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
      <div className="min-h-screen bg-white">
        <AppHeader title="แดชบอร์ดระบบ" breadcrumbs={[{ label: "แดชบอร์ด" }]} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {isLoading ? (
            <SkeletonCards count={3} className="grid grid-cols-1 md:grid-cols-3 gap-4" />
          ) : (
            <div className="card text-center" role="alert">
              <p className="text-rose-600 text-lg mb-4">{error || "ไม่สามารถโหลดสถิติได้"}</p>
              <button type="button" onClick={fetchStats} className="btn-primary">
                ลองใหม่
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="แดชบอร์ดระบบ" breadcrumbs={[{ label: "แดชบอร์ด" }]} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          <div className="card bg-gradient-to-br from-blue-50 to-gray-50 border-l-4 border-blue-700">
            <p className="text-gray-600 text-sm font-semibold mb-2">🏢 ห้องทั้งหมด</p>
            <p className="text-4xl font-bold text-blue-700">{stats.totalRooms}</p>
          </div>

          <div className="card bg-gradient-to-br from-emerald-50 to-gray-50 border-l-4 border-emerald-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">👥 ผู้ใช้ทั้งหมด</p>
            <p className="text-4xl font-bold text-emerald-600">{stats.totalUsers}</p>
          </div>

          <div className="card bg-gradient-to-br from-violet-50 to-gray-50 border-l-4 border-violet-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">📅 การจองทั้งหมด</p>
            <p className="text-4xl font-bold text-violet-600">
              {stats.totalBookings}
            </p>
          </div>

          <div className="card bg-gradient-to-br from-amber-50 to-gray-50 border-l-4 border-amber-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">⏳ รอการตัดสินใจ</p>
            <p className="text-4xl font-bold text-amber-600">
              {stats.pendingBookings}
            </p>
          </div>

          <div className="card bg-gradient-to-br from-emerald-50 to-gray-50 border-l-4 border-emerald-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">✓ อนุมัติแล้ว</p>
            <p className="text-4xl font-bold text-emerald-600">
              {stats.approvedBookings}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bookings by Status */}
          <div className="card bg-gray-50">
            <h2 className="text-2xl font-bold text-blue-700 mb-6">📊 การจองตามสถานะ</h2>
            <div className="space-y-4">
              {Object.entries(stats.bookingsByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center p-4 bg-white rounded-lg hover:shadow-sm transition-shadow">
                  <span className="font-semibold text-gray-700">
                    {status === "APPROVED" ? "✓ อนุมัติแล้ว" :
                     status === "PENDING" ? "⏳ รอการตัดสินใจ" :
                     status === "REJECTED" ? "✕ ปฏิเสธแล้ว" :
                     status === "CANCELLED" ? "🚫 ยกเลิกแล้ว" : status}
                  </span>
                  <span className="text-3xl font-bold text-blue-700">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Room Utilization */}
          <div className="card bg-gray-50">
            <h2 className="text-2xl font-bold text-blue-700 mb-1">📈 การใช้ห้อง</h2>
            <p className="text-sm text-gray-500 mb-6">จำนวนการจองที่อนุมัติแล้ว เรียงจากมากไปน้อย</p>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {stats.roomUtilization.length === 0 ? (
                <p className="text-gray-500 text-center py-8">ยังไม่มีห้องที่มีการจอง</p>
              ) : (
                stats.roomUtilization.map((room) => (
                  <div key={room.roomId} className="p-4 bg-white rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{room.roomName}</p>
                        {room.roomDescription && (
                          <p className="text-xs text-gray-500">{roomLocation(room.roomDescription)}</p>
                        )}
                      </div>
                      <span className="text-white px-3 py-1 rounded-full text-sm font-semibold bg-emerald-600 whitespace-nowrap">
                        อนุมัติแล้ว {room.bookingCount}
                      </span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-700 h-full rounded-full"
                        style={{ width: `${(room.bookingCount / Math.max(...stats.roomUtilization.map(r => r.bookingCount), 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/users">
            <div className="card hover:shadow-lg transition-shadow cursor-pointer">
              <h3 className="font-bold text-blue-700 mb-2">👥 จัดการผู้ใช้</h3>
              <p className="text-sm text-gray-600">
                สร้างและจัดการบัญชีผู้ใช้
              </p>
            </div>
          </Link>

          <Link href="/admin/rooms">
            <div className="card hover:shadow-lg transition-shadow cursor-pointer">
              <h3 className="font-bold text-blue-700 mb-2">🏠 จัดการห้อง</h3>
              <p className="text-sm text-gray-600">
                สร้างและจัดการห้องประชุม
              </p>
            </div>
          </Link>

          <Link href="/admin/pending-approvals">
            <div className="card hover:shadow-lg transition-shadow cursor-pointer">
              <h3 className="font-bold text-blue-700 mb-2">
                ✓ ตรวจสอบการจอง
              </h3>
              <p className="text-sm text-gray-600">
                อนุมัติหรือปฏิเสธการจองที่รอการตัดสินใจ
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
