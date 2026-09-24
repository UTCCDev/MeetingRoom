"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { roomLocation } from "@/lib/format";

interface Room {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  image?: string;
  amenities?: string | string[];
  status?: boolean;
}

export default function MyRoomsPage() {
  const { data: session, status } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Room>>({});

  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "ROOM_ADMIN") {
        router.push("/");
      } else {
        fetchMyRooms();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchMyRooms = async () => {
    try {
      // all=1 returns this room admin's rooms, including disabled ones.
      const response = await fetch("/api/rooms?all=1");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      const userId = (session?.user as any)?.id;
      const myRooms = data.filter(
        (room: any) => room.roomAdmin.id === userId
      );
      setRooms(myRooms);
    } catch (err) {
      setError("ไม่สามารถโหลดห้องของคุณได้");
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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "แก้ไขห้องไม่สำเร็จ");
      }

      toast("บันทึกการแก้ไขห้องแล้ว", { type: "success" });
      setEditingRoomId(null);
      fetchMyRooms();
    } catch (err) {
      toast(err instanceof Error ? err.message : "แก้ไขห้องไม่สำเร็จ", { type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="ห้องที่ฉันดูแล" breadcrumbs={[{ label: "ห้องของฉัน" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--w500 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={2} />
        ) : rooms.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 icon--w300 text-ink-subtle" aria-hidden="true">meeting_room</span>
            <p>
              ยังไม่มีห้องที่คุณดูแล
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {rooms.map((room) => (
              <div key={room.id} className={`card ${editingRoomId === room.id ? "lg:col-span-2 card--elevated" : "p-0 sm:p-0 overflow-hidden flex flex-col"}`}>
                {editingRoomId === room.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <h2 className="flex items-center gap-2 text-title-large text-ink mb-4">
                      <span className="icon icon--24 icon--w500 text-primary" aria-hidden="true">edit_square</span>
                      แก้ไขห้อง
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">
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
                        <label className="field-label">
                          จำนวนที่นั่ง
                        </label>
                        <input
                          type="number"
                          min="1"
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
                      <label className="field-label">
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
                      <label className="field-label">
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
                      <label className="field-label">
                        สิ่งอำนวยความสะดวก (คั่นด้วยเครื่องหมายจุลภาค)
                      </label>
                      <input
                        type="text"
                        value={
                          typeof editData.amenities === "string"
                            ? editData.amenities
                            : Array.isArray(editData.amenities)
                            ? (editData.amenities as string[]).join(", ")
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

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => setEditingRoomId(null)}
                        className="btn-text"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handleSaveRoom}
                        className="btn-primary"
                      >
                        <span className="icon icon--20 icon--w500" aria-hidden="true">save</span>
                        บันทึกการเปลี่ยนแปลง
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="relative aspect-video card__media">
                      {room.image ? (
                        <img src={room.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-primary/40" aria-hidden="true">
                          <span className="icon icon--40 icon--w300">meeting_room</span>
                        </span>
                      )}
                      {room.status === false && (
                        <span className="badge-neutral absolute top-3 left-3 bg-white shadow-sm">
                          <span className="icon icon--20 icon--w500" aria-hidden="true">block</span>
                          ปิดใช้งาน
                        </span>
                      )}
                    </div>
                    <div className="p-4 sm:p-6 flex-1 flex flex-col">
                    <h3 className="card__title mb-1">
                      {room.name}
                    </h3>
                    <p className="icon-lead gap-2 card__body text-ink-subtle mb-4">
                      <span className="icon icon--20 icon--w300" aria-hidden="true">location_on</span>
                      {roomLocation(room.description)}
                    </p>

                    <p className="flex items-center gap-2 text-body-small text-ink-muted mb-4">
                      <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">group</span>
                      <span className="font-medium text-ink tabular-nums">{room.capacity}</span> ที่นั่ง
                    </p>

                    {room.amenities && (
                      <div className="mb-5">
                        <p className="text-body-small text-ink-subtle mb-2">
                          สิ่งอำนวยความสะดวก
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(room.amenities)
                            ? room.amenities
                            : String(room.amenities).split(",")
                          )
                            .map((amenity: any) =>
                              typeof amenity === "string"
                                ? amenity.trim()
                                : amenity
                            )
                            .map((amenity: string) => (
                              <span
                                key={amenity}
                                className="badge-primary"
                              >
                                {amenity}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    </div>
                    <div className="card__footer px-4 sm:px-6 py-3">
                      <button
                        onClick={() => handleEditRoom(room)}
                        className="btn-tonal btn--s"
                      >
                        <span className="icon icon--20 icon--w500" aria-hidden="true">edit</span>
                        แก้ไขห้อง
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
