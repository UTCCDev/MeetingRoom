"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      setError("ไม่สามารถโหลดห้องได้");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-white p-8 text-center">กำลังโหลดห้องประชุม...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-blue-700 font-semibold hover:text-blue-800">
            ← กลับหน้าหลัก
          </Link>
          <h1 className="text-3xl font-bold text-blue-700">
            ค้นหาห้องประชุม
          </h1>
          <div></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Search & Filter Section */}
        <div className="mb-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex gap-4 flex-wrap">
            <input
              type="text"
              placeholder="🔍 ค้นหาห้องประชุม..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-rose-100 text-rose-700 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">ไม่มีห้องประชุมที่ว่างในขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map((room) => (
              <Link key={room.id} href={`/rooms/${room.id}`}>
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer h-full flex flex-col">
                  {/* Room Image */}
                  <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
                    {room.image ? (
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-50">
                        <span className="text-4xl">🏢</span>
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4">
                      <span className="badge-available">✓ ว่าง</span>
                    </div>
                  </div>

                  {/* Room Info */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h2 className="text-xl font-bold text-blue-700 mb-2 line-clamp-2">
                      {room.name}
                    </h2>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{room.description}</p>

                    {/* Room Details */}
                    <div className="space-y-3 mb-6 text-sm">
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-lg">👥</span>
                        <span><span className="font-semibold">{room.capacity}</span> ที่นั่ง</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-lg">👤</span>
                        <span className="font-semibold">{room.roomAdmin.name}</span>
                      </div>
                    </div>

                    {/* Button */}
                    <button className="btn-primary w-full mt-auto">
                      ดูรายละเอียด & จอง →
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
