"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Room {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  image?: string;
  amenities?: string;
  roomAdmin: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function RoomsManagementPage() {
  const { data: session, status } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    capacity: "10",
    image: "",
    amenities: "",
    roomAdminId: "",
  });

  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "SYSTEM_ADMIN") {
        router.push("/");
      } else {
        fetchRooms();
        fetchUsers();
      }
    }
  }, [status, session, router]);

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      setError("Failed to load rooms");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data.filter((u: any) => u.role !== "USER"));
    } catch (err) {
      console.error("Failed to load users");
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const amenitiesArray = formData.amenities
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a);

      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          capacity: parseInt(formData.capacity),
          image: formData.image,
          amenities: amenitiesArray,
          roomAdminId: formData.roomAdminId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create room");
      }

      alert("Room created successfully!");
      setFormData({
        name: "",
        description: "",
        capacity: "10",
        image: "",
        amenities: "",
        roomAdminId: "",
      });
      setShowCreateForm(false);
      fetchRooms();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room?")) return;

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete room");

      alert("Room deleted successfully!");
      fetchRooms();
    } catch (err) {
      alert("Failed to delete room");
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
          <h1 className="text-3xl font-bold text-blue-700">จัดการห้องทั้งหมด</h1>
          <div></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Create Room Form */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="mb-6 btn-primary"
          >
            + เพิ่มห้องใหม่
          </button>
        )}

        {showCreateForm && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4 text-blue-700">สร้างห้องใหม่</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อห้อง *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จำนวนที่นั่ง (คน) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ผู้ดูแลห้อง *
                  </label>
                  <select
                    value={formData.roomAdminId}
                    onChange={(e) =>
                      setFormData({ ...formData, roomAdminId: e.target.value })
                    }
                    className="input-field"
                    required
                  >
                    <option value="">เลือกผู้ดูแลห้อง</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL รูปภาพ
                  </label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) =>
                      setFormData({ ...formData, image: e.target.value })
                    }
                    className="input-field"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input-field"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สิ่งอำนวยความสะดวก (คั่นด้วยเครื่องหมายจุลภาค)
                </label>
                <input
                  type="text"
                  value={formData.amenities}
                  onChange={(e) =>
                    setFormData({ ...formData, amenities: e.target.value })
                  }
                  className="input-field"
                  placeholder="โปรเจกเตอร์, กระดานขาว, วิดีโอคอนเฟอร์เรนซ์, เครื่องพิมพ์"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn-success">
                  สร้างห้อง
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rooms List */}
        {rooms.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500">ไม่พบห้องใดๆ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div key={room.id} className="card">
                {room.image && (
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                )}
                <h3 className="text-lg font-bold mb-2" style={{ color: "#991C3D" }}>
                  {room.name}
                </h3>
                <p className="text-gray-600 text-sm mb-3">{room.description}</p>

                <div className="space-y-1 mb-4 text-sm">
                  <p>
                    <span className="font-medium">จำนวนที่นั่ง:</span> {room.capacity}
                  </p>
                  <p>
                    <span className="font-medium">ผู้ดูแล:</span>{" "}
                    {room.roomAdmin.name}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="btn-danger text-sm flex-1"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
