"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface DashboardStats {
  totalRooms: number;
  totalUsers: number;
  totalBookings: number;
  pendingBookings: number;
  approvedBookings: number;
  roomUtilization: Array<{
    roomId: string;
    roomName: string;
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "SYSTEM_ADMIN") {
        router.push("/");
      } else {
        fetchStats();
      }
    }
  }, [status, session, router]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/dashboard-stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError("Failed to load dashboard statistics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-white p-8 text-center">กำลังโหลด...</div>;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-white p-8 text-center">
        <p className="text-rose-600 text-lg">{error || "ไม่สามารถโหลดสถิติได้"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-blue-700 font-semibold hover:text-blue-800">
            ← กลับหน้าหลัก
          </Link>
          <h1 className="text-3xl font-bold text-blue-700">แดชบอร์ดระบบ</h1>
          <div></div>
        </div>
      </nav>

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
            <h2 className="text-2xl font-bold text-blue-700 mb-6">📈 การใช้ห้อง</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {stats.roomUtilization.length === 0 ? (
                <p className="text-gray-500 text-center py-8">ยังไม่มีห้องที่มีการจอง</p>
              ) : (
                stats.roomUtilization.map((room) => (
                  <div key={room.roomId} className="p-4 bg-white rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-semibold text-gray-800">{room.roomName}</p>
                      <span className="text-white px-3 py-1 rounded-full text-sm font-semibold bg-blue-700">
                        {room.bookingCount} การจอง
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
