"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Booking {
  id: string;
  title: string;
  description?: string;
  user: {
    name: string;
    email: string;
  };
  room: {
    name: string;
  };
  startTime: string;
  endTime: string;
  attendees: number;
}

export default function PendingApprovalsPage() {
  const { data: session, status } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (!userRole || !["ROOM_ADMIN", "SYSTEM_ADMIN"].includes(userRole)) {
        router.push("/");
      } else {
        fetchBookings();
      }
    }
  }, [status, session, router]);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/admin/pending-bookings");
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data);
    } catch (err) {
      setError("Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      if (!response.ok) throw new Error("Failed to approve");

      alert("Booking approved successfully!");
      setBookings(bookings.filter((b) => b.id !== bookingId));
    } catch (err) {
      alert("Failed to approve booking");
    }
  };

  const handleReject = async (bookingId: string) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          rejectionReason,
        }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      alert("Booking rejected successfully!");
      setBookings(bookings.filter((b) => b.id !== bookingId));
      setSelectedBooking(null);
      setRejectionReason("");
    } catch (err) {
      alert("Failed to reject booking");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">กำลังโหลด...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-blue-700 font-semibold hover:text-blue-800">
            ← กลับหน้าหลัก
          </Link>
          <h1 className="text-3xl font-bold text-blue-700">อนุมัติการจองที่รอกการตัดสินใจ</h1>
          <div></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500">ไม่มีการจองที่รอการตัดสินใจให้ตรวจสอบ</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-blue-700">
                      {booking.title}
                    </h3>
                    <p className="text-gray-600">
                      ห้อง: <strong>{booking.room.name}</strong>
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    รอการตัดสินใจ
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">ขอจากผู้ใช้</p>
                    <p className="font-medium">{booking.user.name}</p>
                    <p className="text-sm text-gray-500">{booking.user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">จำนวนผู้ร่วม</p>
                    <p className="font-medium">{booking.attendees} คน</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">เวลาเริ่ม</p>
                    <p className="font-medium">
                      {new Date(booking.startTime).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">เวลาสิ้นสุด</p>
                    <p className="font-medium">
                      {new Date(booking.endTime).toLocaleString("th-TH")}
                    </p>
                  </div>
                </div>

                {booking.description && (
                  <div className="mb-4 p-3 bg-gray-100 rounded">
                    <p className="text-sm text-gray-600">หมายเหตุ:</p>
                    <p>{booking.description}</p>
                  </div>
                )}

                {selectedBooking === booking.id && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      เหตุผลในการปฏิเสธ:
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="input-field mb-2"
                      placeholder="อธิบายว่าทำไมจึงปฏิเสธการจองนี้..."
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(booking.id)}
                    className="btn-success"
                  >
                    ✓ อนุมัติ
                  </button>

                  {selectedBooking === booking.id ? (
                    <>
                      <button
                        onClick={() => handleReject(booking.id)}
                        className="btn-danger"
                      >
                        ยืนยันการปฏิเสธ
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBooking(null);
                          setRejectionReason("");
                        }}
                        className="btn-secondary"
                      >
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedBooking(booking.id)}
                      className="btn-danger"
                    >
                      ✗ ปฏิเสธ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
