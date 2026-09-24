"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { roomCover } from "@/app/components/RoomGallery";
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
          className="flex items-center gap-3 h-11 text-body-small text-ink cursor-pointer"
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
    `input-field ${formErrors[key] ? "border-error" : ""}`;

  const errorText = (key: keyof RoomForm) => (
    <p className="field-error min-h-[1.4rem]">{formErrors[key]}</p>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        title="จัดการห้องทั้งหมด"
        breadcrumbs={[{ label: "จัดการห้อง" }]}
        actions={
          <button onClick={openCreate} className="btn-primary">
            <span className="icon icon--20 icon--w500" aria-hidden="true">add</span>
            เพิ่มห้องใหม่
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--w500 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        <div className="card mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="admin-room-search" className="field-label">ค้นหา</label>
            <div className="relative">
            <span
              className="icon icon--20 icon--w300 absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id="admin-room-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ชื่อห้อง, หน่วยงาน, อาคาร หรือผู้ดูแล"
              className="input-field pl-10"
            />
            </div>
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="admin-room-status" className="field-label">สถานะ</label>
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
          <p className="text-body-small text-ink-muted h-12 flex items-center">พบ <strong className="font-bold text-ink tabular-nums mx-1">{filteredRooms.length}</strong> ห้อง</p>
        </div>

        {isLoading ? (
          <SkeletonCards count={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" />
        ) : filteredRooms.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 icon--w300 text-ink-subtle" aria-hidden="true">search_off</span>
            <p>ไม่พบห้อง</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => (
              <div key={room.id} className="card relative p-0 sm:p-0 flex flex-col">
                <div className={`relative aspect-video card__media rounded-t-md overflow-hidden ${room.status ? "" : "grayscale opacity-60"}`}>
                  <img src={roomCover(room)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  {!room.image && (
                    <span className="absolute top-3 left-3 px-3 py-2 rounded-full bg-ink/70 text-white text-label-medium">
                      ภาพตัวอย่าง
                    </span>
                  )}
                </div>

                <div className="p-4 sm:p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="card__title">{room.name}</h3>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuRoomId(openMenuRoomId === room.id ? null : room.id)}
                      aria-label="ตัวเลือกเพิ่มเติม"
                      aria-expanded={openMenuRoomId === room.id}
                      className="icon-button -mr-2 -mt-2"
                    >
                      <span className="icon icon--24" aria-hidden="true">more_vert</span>
                    </button>
                    {openMenuRoomId === room.id && (
                      <div className="absolute right-0 mt-1 w-48 py-1 bg-white border border-line rounded-sm shadow-lg z-10 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => openEdit(room)}
                          className="w-full flex items-center gap-3 px-4 h-11 text-left text-body-small text-ink hover:bg-canvas"
                        >
                          <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">edit</span>
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(room)}
                          className="w-full flex items-center gap-3 px-4 h-11 text-left text-body-small text-ink hover:bg-canvas"
                        >
                          <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">
                            {room.status ? "toggle_off" : "toggle_on"}
                          </span>
                          {room.status ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuRoomId(null);
                            setRoomPendingDelete(room);
                          }}
                          className="w-full flex items-center gap-3 px-4 h-11 text-left text-body-small text-error border-t border-line hover:bg-error-container"
                        >
                          <span className="icon icon--20 icon--w300" aria-hidden="true">delete</span>
                          ลบ
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="icon-lead gap-2 card__body text-ink-subtle mb-4">
                  <span className="icon icon--20 icon--w300" aria-hidden="true">location_on</span>
                  {roomLocation(room.description)}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-body-small text-ink-muted">
                  <span className="flex items-center gap-2">
                    <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">group</span>
                    <span className="tabular-nums">{room.capacity}</span> ที่นั่ง
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">person</span>
                    {room.roomAdmin.name}
                  </span>
                  <span className={room.status ? "badge-available" : "badge-neutral"}>
                    <span className="icon icon--20 icon--w500" aria-hidden="true">{room.status ? "check_circle" : "block"}</span>
                    {room.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit room modal */}
      {editing && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={() => !isSaving && setEditing(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-form-title"
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="room-form-title" className="flex items-center gap-2 text-title-large text-ink mb-5">
              <span className="icon icon--24 icon--w500 text-primary" aria-hidden="true">
                {editing === "new" ? "add_business" : "edit_square"}
              </span>
              {editing === "new" ? "สร้างห้องใหม่" : `แก้ไขห้อง "${editing.name}"`}
            </h2>

            {formError && (
              <div className="alert alert--error mb-4" role="alert">
                <span className="icon icon--24 icon--w500 icon--error" aria-hidden="true">error</span>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-2" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <div>
                  <label htmlFor="room-name" className="field-label">ชื่อห้อง *</label>
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
                  <label htmlFor="room-capacity" className="field-label">จำนวนที่นั่ง (คน) *</label>
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
                  <label htmlFor="room-department" className="field-label">หน่วยงาน</label>
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
                  <label htmlFor="room-building" className="field-label">อาคาร</label>
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
                  <label htmlFor="room-floor" className="field-label">ชั้น</label>
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
                  <label htmlFor="room-admin" className="field-label">ผู้ดูแลห้อง *</label>
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
                  <label htmlFor="room-image" className="field-label">URL รูปภาพ</label>
                  <input
                    id="room-image"
                    type="url"
                    value={form.image}
                    onChange={(e) => updateField("image", e.target.value)}
                    className={fieldClass("image")}
                    placeholder="https://example.com/image.jpg"
                    aria-invalid={!!formErrors.image}
                    aria-describedby="room-image-hint"
                  />
                  {errorText("image")}
                </div>

                {/* What the room card and gallery will show. */}
                <div className="md:col-span-2 flex items-center gap-4 p-3 mb-2 rounded-sm border border-line bg-canvas">
                  <img
                    src={
                      form.image.trim() ||
                      roomCover({ id: editing === "new" ? "new" : editing.id, capacity: Number(form.capacity) || 10 })
                    }
                    alt=""
                    className="w-32 aspect-video flex-none rounded-xs object-cover bg-surface-variant"
                  />
                  <p id="room-image-hint" className="text-body-small text-ink-muted">
                    {form.image.trim()
                      ? "ตัวอย่างรูปที่จะแสดงบนการ์ดห้องและหน้ารายละเอียด"
                      : "ยังไม่ได้ใส่รูป — ระบบจะแสดงภาพตัวอย่างตามขนาดห้อง (ติดป้าย \"ภาพตัวอย่าง\")"}
                  </p>
                </div>
              </div>

              <fieldset>
                <legend className="field-label">สิ่งอำนวยความสะดวก</legend>
                <AmenityCheckboxes
                  selected={form.amenities}
                  onChange={(next) => updateField("amenities", next)}
                />
              </fieldset>

              <label className="flex items-center gap-3 text-body-small text-ink pt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => updateField("status", e.target.checked)}
                />
                เปิดให้จอง (ปิดแล้วห้องจะไม่แสดงในหน้าค้นหา)
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditing(null)} className="btn-text" disabled={isSaving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  <span className="icon icon--20 icon--w500" aria-hidden="true">save</span>
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
            คุณต้องการลบห้อง <span className="font-medium text-ink">"{roomPendingDelete.name}"</span> ใช่หรือไม่?
            การลบไม่สามารถย้อนกลับได้ หากห้องนี้มีการจองค้างอยู่ ระบบจะปิดใช้งานห้องแทนการลบ
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
