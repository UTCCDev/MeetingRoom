"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Room {
  id: string;
  name: string;
  description: string;
  capacity: number;
  image?: string;
  amenities?: string;
  roomAdmin: {
    name: string;
    email: string;
  };
}

interface Booking {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function RoomDetailPage() {
  const params = useParams();
  const roomId = params?.id as string;
  const [room, setRoom] = useState<Room | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (roomId) {
      fetchRoomDetails();
    }
  }, [roomId]);

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (!response.ok) throw new Error("Failed to fetch room");
      const data = await response.json();
      setRoom(data);

      // Fetch existing bookings for this room
      const bookingsResponse = await fetch(
        `/api/rooms/${roomId}/bookings`
      ).catch(() => null);
      if (bookingsResponse?.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData);
      }
    } catch (err) {
      setError("Failed to load room details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title || !startTime || !endTime) {
      setError("กรุณากรอกข้อมูลในช่องที่จำเป็น");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      setError("เวลาสิ้นสุดต้องมาหลังจากเวลาเริ่มต้น");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomId,
          title,
          description,
          attendees: parseInt(attendees),
          startTime,
          endTime,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Booking failed");
      }

      alert("การจองสำเร็จ! รอการอนุมัติจากผู้ดูแลห้อง");
      router.push("/my-bookings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถสร้างการจองได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">กำลังโหลด...</div>;
  }

  if (!room) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">ไม่พบห้องนี้</p>
      </div>
    );
  }

  const amenitiesList = Array.isArray(room.amenities)
    ? room.amenities
    : [];

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/rooms" className="text-blue-700 font-semibold hover:text-blue-800">
            ← กลับไปยังห้อง
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room Details */}
          <div className="lg:col-span-2">
            <div className="card">
              {room.image && (
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-96 object-cover rounded-lg mb-6"
                />
              )}
              <h1 className="text-3xl font-bold mb-4 text-blue-700">
                {room.name}
              </h1>
              <p className="text-gray-600 mb-4">{room.description}</p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="font-medium">จำนวนที่นั่ง:</span>
                  <span>{room.capacity} คน</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">ผู้ดูแลห้อง:</span>
                  <span>{room.roomAdmin.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">อีเมล:</span>
                  <span>{room.roomAdmin.email}</span>
                </div>
              </div>

              {amenitiesList.length > 0 && (
                <div>
                  <h3 className="font-bold mb-2">สิ่งอำนวยความสะดวก:</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenitiesList.map((amenity: string) => (
                      <span
                        key={amenity}
                        className="text-white px-3 py-1 rounded-full text-sm bg-blue-700"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Calendar */}
            <div className="card mt-8">
              <h2 className="text-2xl font-bold mb-4 text-blue-700">ตารางการจอง</h2>
              {bookings.length === 0 ? (
                <p className="text-gray-500">ไม่มีการจองสำหรับห้องนี้</p>
              ) : (
                <div className="space-y-2">
                  {bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`p-3 rounded border ${
                        booking.status === "APPROVED"
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <p className="font-medium">{booking.title}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(booking.startTime).toLocaleString("th-TH")} - {new Date(booking.endTime).toLocaleString("th-TH")}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          booking.status === "APPROVED"
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {booking.status === "APPROVED" ? "อนุมัติแล้ว" : "รอการตัดสินใจ"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="card h-fit sticky top-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">จองห้องนี้</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อเรื่องการประชุม *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  placeholder="เช่น ประชุมทีมงาน"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field"
                  placeholder="รายละเอียดของการประชุม..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนผู้เข้าร่วม
                </label>
                <input
                  type="number"
                  min="1"
                  max={room.capacity}
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาเริ่มต้น *
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาสิ้นสุด *
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary disabled:opacity-50"
              >
                {isSubmitting ? "กำลังจอง..." : "ส่งคำขอจอง"}
              </button>
              <p className="text-xs text-gray-500 text-center">
                การจองจะรอการอนุมัติจากผู้ดูแลห้อง
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
