import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/app/components/LogoutButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const userRole = (session.user as any)?.role;

  const roleDisplay = {
    USER: "ผู้ใช้ทั่วไป",
    ROOM_ADMIN: "ผู้ดูแลห้อง",
    SYSTEM_ADMIN: "ผู้ดูแลระบบ",
  }[userRole] || userRole;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-blue-700">ระบบจองห้องประชุม</h1>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-gray-700">ยินดีต้อนรับ, {session.user?.name}</span>
            <span className="text-sm text-white px-4 py-2 rounded-full bg-blue-700 font-semibold">
              {roleDisplay}
            </span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">เมนูหลัก</h2>
          <p className="text-gray-600 text-lg">เลือกฟีเจอร์ที่ต้องการใช้งาน</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Available for all users */}
          <Link href="/rooms">
            <div className="card bg-white hover:shadow-lg cursor-pointer">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">📋</span>
                <h3 className="text-xl font-semibold text-blue-700">ค้นหาห้อง</h3>
              </div>
              <p className="text-gray-600">ดูรายชื่อห้องประชุมที่ว่างและจองห้องเพื่อการประชุมของคุณ</p>
            </div>
          </Link>

          <Link href="/my-bookings">
            <div className="card bg-white hover:shadow-lg cursor-pointer">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">📅</span>
                <h3 className="text-xl font-semibold text-blue-700">การจองของฉัน</h3>
              </div>
              <p className="text-gray-600">ดูประวัติการจองและจัดการการจองของคุณ</p>
            </div>
          </Link>

          {/* Room Admin only */}
          {userRole === "ROOM_ADMIN" && (
            <>
              <Link href="/admin/pending-approvals">
                <div className="card bg-white hover:shadow-lg cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">✅</span>
                    <h3 className="text-xl font-semibold text-emerald-600">อนุมัติการจอง</h3>
                  </div>
                  <p className="text-gray-600">ตรวจสอบและอนุมัติ/ปฏิเสธคำขอจองห้อง</p>
                </div>
              </Link>

              <Link href="/admin/my-rooms">
                <div className="card bg-white hover:shadow-lg cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">🛠️</span>
                    <h3 className="text-xl font-semibold text-blue-700">จัดการห้องของฉัน</h3>
                  </div>
                  <p className="text-gray-600">แก้ไขข้อมูลห้องและจัดการรายละเอียด</p>
                </div>
              </Link>
            </>
          )}

          {/* System Admin only */}
          {userRole === "SYSTEM_ADMIN" && (
            <>
              <Link href="/admin/dashboard">
                <div className="card bg-white hover:shadow-lg cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">📊</span>
                    <h3 className="text-xl font-semibold text-blue-700">แดชบอร์ด</h3>
                  </div>
                  <p className="text-gray-600">ดูสถิติระบบและการใช้งาน</p>
                </div>
              </Link>

              <Link href="/admin/users">
                <div className="card bg-white hover:shadow-lg cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">👥</span>
                    <h3 className="text-xl font-semibold text-blue-700">จัดการผู้ใช้</h3>
                  </div>
                  <p className="text-gray-600">สร้างผู้ใช้และจัดการบทบาทสิทธิ์</p>
                </div>
              </Link>

              <Link href="/admin/rooms">
                <div className="card bg-white hover:shadow-lg cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">🏠</span>
                    <h3 className="text-xl font-semibold text-blue-700">จัดการห้องทั้งหมด</h3>
                  </div>
                  <p className="text-gray-600">จัดการห้องประชุมทั้งหมด</p>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600">
          <p className="font-semibold">ระบบจองห้องประชุมรวมศูนย์</p>
          <p className="text-sm mt-2">© 2026 - ทุกสิทธิ์สงวนไว้</p>
        </div>
      </footer>
    </div>
  );
}
