"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { roomLocation } from "@/lib/format";

interface Room {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  image?: string;
  amenities?: string[];
  status: boolean;
  roomAdmin: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

const AMENITY_OPTIONS = [
  { value: "projector", label: "โปรเจกเตอร์" },
  { value: "whiteboard", label: "กระดานไวท์บอร์ด" },
  { value: "videoconference", label: "ระบบวิดีโอคอนเฟอเรนซ์" },
  { value: "printer", label: "เครื่องพิมพ์" },
  { value: "tv", label: "โทรทัศน์ / จอมอนิเตอร์" },
  { value: "microphone", label: "ไมโครโฟน" },
];

type RoomForm = {
  name: string;
  department: string;
  building: string;
  floor: string;
  capacity: string;
  image: string;
  amenities: string[];
  roomAdminId: string;
  status: boolean;
};

const EMPTY_FORM: RoomForm = {
  name: "",
  department: "",
  building: "",
  floor: "",
  capacity: "10",
  image: "",
  amenities: [],
  roomAdminId: "",
  status: true,
};

// Room descriptions are stored as "หน่วยงาน - อาคาร X ชั้น Y".
const DESCRIPTION_PATTERN = /^(.*?)\s+-\s+อาคาร\s*(.+?)(?:\s+ชั้น\s*(.+))?$/;

function parseDescription(description?: string) {
  const m = (description || "").match(DESCRIPTION_PATTERN);
  if (!m) return { department: description || "", building: "", floor: "" };
  return { department: m[1].trim(), building: m[2].trim(), floor: (m[3] || "").trim() };
}

function composeDescription(f: RoomForm) {
  const location = [f.building.trim() && `อาคาร ${f.building.trim()}`, f.floor.trim() && `ชั้น ${f.floor.trim()}`]
    .filter(Boolean)
    .join(" ");
  return [f.department.trim(), location].filter(Boolean).join(" - ");
}

function AmenityCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AMENITY_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          htmlFor={`room-amenity-${opt.value}`}
          className="flex items-center gap-2 text-sm text-gray-700"
        >
          <input
            id={`room-amenity-${opt.value}`}
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, opt.value]
                  : selected.filter((a) => a !== opt.value)
              )
            }
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export default function RoomsManagementPage() {
  const { data: session, status } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [openMenuRoomId, setOpenMenuRoomId] = useState<string | null>(null);
  // null = closed, "new" = create, otherwise the room being edited
  const [editing, setEditing] = useState<Room | "new" | null>(null);
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RoomForm, string>>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [roomPendingDelete, setRoomPendingDelete] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "SYSTEM_ADMIN") {
        router.push("/");
      } else {
        fetchRooms();
        fetchUsers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchRooms = async () => {
    try {
      // all=1 includes disabled rooms so they can be re-enabled.
      const response = await fetch("/api/rooms?all=1");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      setError("ไม่สามารถโหลดรายการห้องได้");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data: User[] = await response.json();
      setUsers(data.filter((u) => u.role !== "USER" && u.active !== false));
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("โหลดรายชื่อผู้ดูแลห้องไม่สำเร็จ จึงยังเลือกผู้ดูแลห้องไม่ได้ กรุณารีเฟรชหน้า");
    }
  };

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter(
      (r) =>
        (!q ||
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          r.roomAdmin.name.toLowerCase().includes(q)) &&
        (!statusFilter || (statusFilter === "active" ? r.status : !r.status))
    );
  }, [rooms, search, statusFilter]);

  const openCreate = () => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError("");
  };

  const openEdit = (room: Room) => {
    setOpenMenuRoomId(null);
    setEditing(room);
    setForm({
      name: room.name,
      ...parseDescription(room.description),
      capacity: String(room.capacity),
      image: room.image || "",
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
      roomAdminId: room.roomAdmin.id,
      status: room.status,
    });
    setFormErrors({});
    setFormError("");
  };

  const updateField = <K extends keyof RoomForm>(key: K, value: RoomForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
    setFormError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    const errors: Partial<Record<keyof RoomForm, string>> = {};
    const capacity = Number(form.capacity);
    if (!form.name.trim()) errors.name = "กรุณากรอกชื่อห้อง";
    if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 1";
    if (!form.roomAdminId) errors.roomAdminId = "กรุณาเลือกผู้ดูแลห้อง";
    if (form.image && !/^https?:\/\//i.test(form.image.trim())) {
      errors.image = "URL ต้องขึ้นต้นด้วย http:// หรือ https://";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const isCreate = editing === "new";
    setIsSaving(true);
    try {
      const response = await fetch(isCreate ? "/api/rooms" : `/api/rooms/${editing.id}`, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: composeDescription(form),
          capacity,
          image: form.image.trim(),
          amenities: form.amenities,
          roomAdminId: form.roomAdminId,
          status: form.status,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "บันทึกห้องไม่สำเร็จ");

      toast(isCreate ? "สร้างห้องแล้ว" : "บันทึกการแก้ไขห้องแล้ว", { type: "success" });
      setEditing(null);
      fetchRooms();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "บันทึกห้องไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (room: Room) => {
    setOpenMenuRoomId(null);
    try {
      const response = await fetch(`/api/rooms/${room.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: !room.status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "เปลี่ยนสถานะไม่สำเร็จ");
      setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, status: !room.status } : r)));
      toast(room.status ? `ปิดใช้งาน "${room.name}" แล้ว` : `เปิดใช้งาน "${room.name}" แล้ว`, { type: "success" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ", { type: "error" });
    }
  };

  const confirmDeleteRoom = async () => {
    if (!roomPendingDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/rooms/${roomPendingDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "ลบห้องไม่สำเร็จ");
      }

      toast(data.message || "ลบห้องเรียบร้อยแล้ว", { type: "success" });
      setRoomPendingDelete(null);
      fetchRooms();
    } catch (err) {
      toast(err instanceof Error ? err.message : "ลบห้องไม่สำเร็จ", { type: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  const fieldClass = (key: keyof RoomForm) =>
    `input-field ${formErrors[key] ? "border-red-500 focus:ring-red-500" : ""}`;

  const errorText = (key: keyof RoomForm) => (
    <p className="text-xs text-red-600 mt-1 min-h-[1rem]">{formErrors[key]}</p>
  );

  return (
    <div className="min-h-screen bg-white">
      <AppHeader
        title="จัดการห้องทั้งหมด"
        breadcrumbs={[{ label: "จัดการห้อง" }]}
        actions={
          <button onClick={openCreate} className="btn-primary">
            + เพิ่มห้องใหม่
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="admin-room-search" className="block text-sm font-medium text-gray-700 mb-1">ค้นหา</label>
            <input
              id="admin-room-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ชื่อห้อง, หน่วยงาน, อาคาร หรือผู้ดูแล"
              className="input-field"
            />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="admin-room-status" className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
            <select
              id="admin-room-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="input-field"
            >
              <option value="">ทั้งหมด</option>
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </div>
          <p className="text-sm text-gray-600 py-3">พบ {filteredRooms.length} ห้อง</p>
        </div>

        {isLoading ? (
          <SkeletonCards count={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" />
        ) : filteredRooms.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500">ไม่พบห้อง</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <div key={room.id} className={`card relative ${room.status ? "" : "opacity-70"}`}>
                {room.image && (
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-36 object-cover rounded-lg mb-4"
                  />
                )}

                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="text-lg font-bold text-blue-700">{room.name}</h3>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuRoomId(openMenuRoomId === room.id ? null : room.id)}
                      aria-label="ตัวเลือกเพิ่มเติม"
                      aria-expanded={openMenuRoomId === room.id}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                    >
                      ⋯
                    </button>
                    {openMenuRoomId === room.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => openEdit(room)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(room)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {room.status ? "⏸ ปิดใช้งาน" : "▶️ เปิดใช้งาน"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuRoomId(null);
                            setRoomPendingDelete(room);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-3">{roomLocation(room.description)}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span>👥 {room.capacity} ที่นั่ง</span>
                  <span>👤 {room.roomAdmin.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      room.status ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {room.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit room modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => !isSaving && setEditing(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-form-title"
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="room-form-title" className="text-xl font-bold mb-4 text-blue-700">
              {editing === "new" ? "สร้างห้องใหม่" : `แก้ไขห้อง "${editing.name}"`}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm" role="alert">{formError}</div>
            )}

            <form onSubmit={handleSave} className="space-y-2" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <div>
                  <label htmlFor="room-name" className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้อง *</label>
                  <input
                    id="room-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={fieldClass("name")}
                    aria-invalid={!!formErrors.name}
                  />
                  {errorText("name")}
                </div>

                <div>
                  <label htmlFor="room-capacity" className="block text-sm font-medium text-gray-700 mb-1">จำนวนที่นั่ง (คน) *</label>
                  <input
                    id="room-capacity"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.capacity}
                    onChange={(e) => updateField("capacity", e.target.value)}
                    className={fieldClass("capacity")}
                    aria-invalid={!!formErrors.capacity}
                  />
                  {errorText("capacity")}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="room-department" className="block text-sm font-medium text-gray-700 mb-1">หน่วยงาน</label>
                  <input
                    id="room-department"
                    type="text"
                    value={form.department}
                    onChange={(e) => updateField("department", e.target.value)}
                    className="input-field"
                    placeholder="เช่น สำนักทะเบียนและประมวลผล"
                  />
                  {errorText("department")}
                </div>

                <div>
                  <label htmlFor="room-building" className="block text-sm font-medium text-gray-700 mb-1">อาคาร</label>
                  <input
                    id="room-building"
                    type="text"
                    value={form.building}
                    onChange={(e) => updateField("building", e.target.value)}
                    className="input-field"
                    placeholder="เช่น 1"
                  />
                  {errorText("building")}
                </div>

                <div>
                  <label htmlFor="room-floor" className="block text-sm font-medium text-gray-700 mb-1">ชั้น</label>
                  <input
                    id="room-floor"
                    type="text"
                    value={form.floor}
                    onChange={(e) => updateField("floor", e.target.value)}
                    className="input-field"
                    placeholder="เช่น 2"
                  />
                  {errorText("floor")}
                </div>

                <div>
                  <label htmlFor="room-admin" className="block text-sm font-medium text-gray-700 mb-1">ผู้ดูแลห้อง *</label>
                  <select
                    id="room-admin"
                    value={form.roomAdminId}
                    onChange={(e) => updateField("roomAdminId", e.target.value)}
                    className={fieldClass("roomAdminId")}
                    aria-invalid={!!formErrors.roomAdminId}
                  >
                    <option value="">เลือกผู้ดูแลห้อง</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                  {errorText("roomAdminId")}
                </div>

                <div>
                  <label htmlFor="room-image" className="block text-sm font-medium text-gray-700 mb-1">URL รูปภาพ</label>
                  <input
                    id="room-image"
                    type="url"
                    value={form.image}
                    onChange={(e) => updateField("image", e.target.value)}
                    className={fieldClass("image")}
                    placeholder="https://example.com/image.jpg"
                    aria-invalid={!!formErrors.image}
                  />
                  {errorText("image")}
                </div>
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-2">สิ่งอำนวยความสะดวก</legend>
                <AmenityCheckboxes
                  selected={form.amenities}
                  onChange={(next) => updateField("amenities", next)}
                />
              </fieldset>

              <label className="flex items-center gap-2 text-sm pt-3">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => updateField("status", e.target.checked)}
                />
                เปิดให้จอง (ปิดแล้วห้องจะไม่แสดงในหน้าค้นหา)
              </label>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary" disabled={isSaving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-success disabled:opacity-50" disabled={isSaving}>
                  {isSaving ? "กำลังบันทึก..." : editing === "new" ? "สร้างห้อง" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!roomPendingDelete}
        title="ยืนยันการลบห้อง"
        confirmLabel="ยืนยันลบ"
        tone="danger"
        busy={isDeleting}
        onConfirm={confirmDeleteRoom}
        onCancel={() => setRoomPendingDelete(null)}
      >
        {roomPendingDelete && (
          <>
            คุณต้องการลบห้อง <span className="font-semibold">"{roomPendingDelete.name}"</span> ใช่หรือไม่?
            การลบไม่สามารถย้อนกลับได้ หากห้องนี้มีการจองค้างอยู่ ระบบจะปิดใช้งานห้องแทนการลบ
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
