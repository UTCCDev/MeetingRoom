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
}

export default function MyRoomsPage() {
  const { data: session, status } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Room>>({});

  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "ROOM_ADMIN") {
        router.push("/");
      } else {
        fetchMyRooms();
      }
    }
  }, [status, session, router]);

  const fetchMyRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      const userId = (session?.user as any)?.id;
      const myRooms = data.filter(
        (room: any) => room.roomAdmin.id === userId
      );
      setRooms(myRooms);
    } catch (err) {
      setError("Failed to load your rooms");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setEditData(room);
  };

  const handleSaveRoom = async () => {
    if (!editingRoomId) return;

    try {
      const amenitiesArray = editData.amenities
        ? (typeof editData.amenities === "string"
            ? editData.amenities
                .split(",")
                .map((a) => a.trim())
            : editData.amenities
          ).filter((a: any) => a)
        : [];

      const response = await fetch(`/api/rooms/${editingRoomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editData.name,
          description: editData.description,
          capacity: editData.capacity,
          image: editData.image,
          amenities: amenitiesArray,
        }),
      });

      if (!response.ok) throw new Error("Failed to update room");

      alert("Room updated successfully!");
      setEditingRoomId(null);
      fetchMyRooms();
    } catch (err) {
      alert("Failed to update room");
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
          <h1 className="text-3xl font-bold text-blue-700">ห้องของหน่วย</h1>
          <div></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500">
              You don't have any rooms assigned yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {rooms.map((room) => (
              <div key={room.id} className="card">
                {editingRoomId === room.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold mb-4 text-blue-700">แก้ไขห้อง</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ชื่อห้อง
                        </label>
                        <input
                          type="text"
                          value={editData.name || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className="input-field"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          จำนวนที่นั่ง
                        </label>
                        <input
                          type="number"
                          value={editData.capacity || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              capacity: parseInt(e.target.value),
                            })
                          }
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียด
                      </label>
                      <textarea
                        value={editData.description || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            description: e.target.value,
                          })
                        }
                        className="input-field"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL รูปภาพ
                      </label>
                      <input
                        type="text"
                        value={editData.image || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, image: e.target.value })
                        }
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        สิ่งอำนวยความสะดวก (คั่นด้วยเครื่องหมายจุลภาค)
                      </label>
                      <input
                        type="text"
                        value={
                          typeof editData.amenities === "string"
                            ? editData.amenities
                            : Array.isArray(editData.amenities)
                            ? editData.amenities.join(", ")
                            : ""
                        }
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            amenities: e.target.value,
                          })
                        }
                        className="input-field"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveRoom}
                        className="btn-success"
                      >
                        บันทึกการเปลี่ยนแปลง
                      </button>
                      <button
                        onClick={() => setEditingRoomId(null)}
                        className="btn-secondary"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    {room.image && (
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <h3 className="text-2xl font-bold mb-2 text-blue-700">
                      {room.name}
                    </h3>
                    <p className="text-gray-600 mb-4">{room.description}</p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">จำนวนที่นั่ง</p>
                        <p className="font-bold">{room.capacity} คน</p>
                      </div>
                    </div>

                    {room.amenities && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-600 mb-2">
                          Amenities:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(room.amenities)
                            ? room.amenities
                            : room.amenities.split(",")
                          )
                            .map((amenity: any) =>
                              typeof amenity === "string"
                                ? amenity.trim()
                                : amenity
                            )
                            .map((amenity: string) => (
                              <span
                                key={amenity}
                                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                              >
                                {amenity}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditRoom(room)}
                        className="btn-primary"
                      >
                        Edit Room
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
