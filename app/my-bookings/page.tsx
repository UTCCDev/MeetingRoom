"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Booking {
  id: string;
  title: string;
  description?: string;
  room: {
    id: string;
    name: string;
  };
  startTime: string;
  endTime: string;
  status: string;
  attendees: number;
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const router = useRouter();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data);
    } catch (err) {
      setError("ไม่สามารถโหลดการจองได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm("คุณแน่ใจหรือว่าต้องการยกเลิกการจองนี้?")) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to cancel booking");
      
      alert("ยกเลิกการจองสำเร็จแล้ว");
      setBookings(bookings.filter((b) => b.id !== bookingId));
    } catch (err) {
      alert("ไม่สามารถยกเลิกการจองได้");
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === "ALL") return true;
    return b.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "badge-available"; // Green
      case "REJECTED":
      case "CANCELLED":
        return "badge-booked"; // Red
      case "PENDING":
        return "badge-pending"; // Amber
      default:
        return "badge-booked";
    }
  };

  const statusThaiTranslate = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "อนุมัติแล้ว";
      case "REJECTED":
        return "ปฏิเสธแล้ว";
      case "PENDING":
        return "รอการตัดสินใจ";
      case "CANCELLED":
        return "ยกเลิกแล้ว";
      default:
        return status;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-white p-8 text-center">กำลังโหลด...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-blue-700 font-semibold hover:text-blue-800">
            ← กลับหน้าหลัก
          </Link>
          <h1 className="text-3xl font-bold text-blue-700">
            การจองของฉัน
          </h1>
          <div></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Filter Buttons */}
        <div className="mb-8 flex flex-wrap gap-2">
          {[
            { value: "ALL", label: "ทั้งหมด" },
            { value: "PENDING", label: "รอการตัดสินใจ" },
            { value: "APPROVED", label: "อนุมัติแล้ว" },
            { value: "REJECTED", label: "ปฏิเสธแล้ว" },
            { value: "CANCELLED", label: "ยกเลิกแล้ว" }
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filter === value
                  ? "btn-primary"
                  : "btn-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-100 text-rose-700 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {filteredBookings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-6">
              {bookings.length === 0
                ? "คุณยังไม่มีการจองใดๆ"
                : "ไม่มีการจองที่ตรงกับตัวกรองที่เลือก"}
            </p>
            <Link href="/rooms" className="btn-primary inline-block">
              ค้นหาห้องประชุม →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="card bg-gray-50 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-blue-700 mb-2">
                      {booking.title}
                    </h3>
                    <p className="text-gray-600 text-lg">
                      📍 <strong>{booking.room.name}</strong>
                    </p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(booking.status)} flex-shrink-0`}>
                    {statusThaiTranslate(booking.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pb-6 border-b border-gray-300">
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">⏰ เวลาเริ่ม</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(booking.startTime).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">⏰ เวลาสิ้นสุด</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(booking.endTime).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">👥 จำนวนผู้ร่วม</p>
                    <p className="font-semibold text-gray-800">{booking.attendees} คน</p>
                  </div>
                </div>

                {booking.description && (
                  <div className="mb-4 p-3 bg-gray-100 rounded">
                    <p className="text-sm text-gray-600">หมายเหตุ:</p>
                    <p>{booking.description}</p>
                  </div>
                )}

                {booking.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancel(booking.id)}
                      className="btn-danger"
                    >
                      ยกเลิกการจอง
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
