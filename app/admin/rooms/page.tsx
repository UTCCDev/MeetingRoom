"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import Dropdown from "@/app/components/Dropdown";
import RoomGuideDialog from "@/app/components/RoomGuideDialog";
import { roomCover } from "@/app/components/RoomGallery";
import PhotoGuide from "@/app/components/PhotoGuide";
import AmenityCheckboxes from "@/app/components/AmenityCheckboxes";
import { PHOTO_SHOTS, PHOTO_URL_ERROR, isPhotoUrl, parseRoomPhotos, type RoomPhotos } from "@/lib/room-photos";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { formatPricePerHour, roomLocation } from "@/lib/format";
import Pagination, { usePagination } from "@/app/components/Pagination";

interface Room {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  pricePerHour: number;
  image?: string;
  amenities?: string[];
  photos?: unknown;
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


type RoomForm = {
  name: string;
  department: string;
  building: string;
  floor: string;
  capacity: string;
  pricePerHour: string;
  image: string;
  amenities: string[];
  photos: RoomPhotos;
  roomAdminId: string;
  status: boolean;
};

const EMPTY_FORM: RoomForm = {
  name: "",
  department: "",
  building: "",
  floor: "",
  capacity: "10",
  pricePerHour: "500",
  image: "",
  amenities: [],
  photos: {},
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
  const [guideOpen, setGuideOpen] = useState(false);
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
  const paged = usePagination(filteredRooms, 12, `${search}|${statusFilter}`);

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
      pricePerHour: String(room.pricePerHour),
      image: room.image || "",
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
      photos: parseRoomPhotos(room.photos),
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
    const pricePerHour = Number(form.pricePerHour);
    if (!form.name.trim()) errors.name = "กรุณากรอกชื่อห้อง";
    if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 1";
    if (!Number.isInteger(pricePerHour) || pricePerHour < 0) errors.pricePerHour = "ราคาค่าเช่าต้องเป็นจำนวนเต็มตั้งแต่ 0";
    if (!form.roomAdminId) errors.roomAdminId = "กรุณาเลือกผู้ดูแลห้อง";
    if (!isPhotoUrl(form.image)) {
      errors.image = PHOTO_URL_ERROR;
    }
    if (PHOTO_SHOTS.some((shot) => !isPhotoUrl(form.photos[shot] || ""))) {
      errors.photos = `รูปห้องและอุปกรณ์${PHOTO_URL_ERROR}`;
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
          pricePerHour,
          image: form.image.trim(),
          amenities: form.amenities,
          photos: form.photos,
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

  const errorText = (key: keyof RoomForm) =>
    formErrors[key] ? <p className="field-error">{formErrors[key]}</p> : null;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        title="จัดการห้องทั้งหมด"
        breadcrumbs={[{ label: "จัดการห้อง" }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setGuideOpen(true)} className="btn-secondary">
              <span className="icon icon--20" aria-hidden="true">menu_book</span>
              คู่มือ
            </button>
            <button onClick={openCreate} className="btn-primary">
              <span className="icon icon--20" aria-hidden="true">add</span>
              เพิ่มห้องใหม่
            </button>
          </div>
        }
      />

      <div className="max-w-[75rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        <div className="card mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="admin-room-search" className="field-label">ค้นหา</label>
            <div className="relative">
            <span
              className="icon icon--20 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
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
              className="input-field pl-11"
            />
            </div>
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="admin-room-status" className="field-label">สถานะ</label>
            <Dropdown
              id="admin-room-status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: "", label: "ทั้งหมด" },
                { value: "active", label: "เปิดใช้งาน" },
                { value: "inactive", label: "ปิดใช้งาน" },
              ]}
            />
          </div>
          <p className="text-body-small text-ink-muted h-12 flex items-center">พบ <strong className="font-bold text-ink tabular-nums mx-1">{filteredRooms.length}</strong> ห้อง</p>
        </div>

        {isLoading ? (
          <SkeletonCards count={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" />
        ) : filteredRooms.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 text-ink-subtle" aria-hidden="true">search_off</span>
            <p>ไม่พบห้อง</p>
          </div>
        ) : (
          <div ref={paged.listRef} className="scroll-mt-24">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paged.pageItems.map((room) => (
                <div key={room.id} className="card relative p-0 sm:p-0 flex flex-col">
                  <div className={`relative aspect-video card__media rounded-t-md overflow-hidden ${room.status ? "" : "grayscale opacity-60"}`}>
                    <img src={roomCover(room)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    {!room.image && (
                      <span className="absolute top-3 left-3 badge-neutral !bg-ink/70 !text-white">
                        ภาพจำลอง
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
                        <div className="absolute right-0 mt-2 min-w-[13rem] py-2 bg-white border border-line rounded-md shadow-[var(--shadow-2)] z-10 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => openEdit(room)}
                            className="w-full flex items-center gap-3 px-5 min-h-[52px] text-left text-body-medium text-ink hover:bg-surface-variant"
                          >
                            <span className="icon icon--20 text-ink-subtle" aria-hidden="true">edit</span>
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuRoomId(null);
                              setRoomPendingDelete(room);
                            }}
                            className="w-full flex items-center gap-3 px-5 min-h-[52px] mt-2 text-left text-body-medium text-error border-t border-line hover:bg-error-container"
                          >
                            <span className="icon icon--20" aria-hidden="true">delete</span>
                            ลบ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
  
                  <p className="icon-lead gap-2 card__body text-ink-subtle mb-4">
                    <span className="icon icon--20" aria-hidden="true">location_on</span>
                    {roomLocation(room.description)}
                  </p>
  
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-body-small text-ink-muted">
                    <span className="flex items-center gap-2">
                      <span className="icon icon--20 text-ink-subtle" aria-hidden="true">group</span>
                      <span className="tabular-nums">{room.capacity}</span> ที่นั่ง
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="icon icon--20 text-ink-subtle" aria-hidden="true">person</span>
                      {room.roomAdmin.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="icon icon--20 text-ink-subtle" aria-hidden="true">payments</span>
                      {formatPricePerHour(room.pricePerHour)}
                    </span>
                  </div>
  
                  {/* Applies immediately, so a switch (design.md › Switch); a failed save keeps the old value. */}
                  <label className="switch mt-4 pt-4 border-t border-line">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={room.status}
                      onChange={() => toggleStatus(room)}
                    />
                    เปิดให้จอง
                  </label>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={paged.page}
              pageCount={paged.pageCount}
              onChange={paged.setPage}
              from={paged.from}
              to={paged.to}
              total={filteredRooms.length}
              unit="ห้อง"
            />
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
            // Only the body scrolls, so the scrollbar stays inside the rounded corners
            // and the title and buttons stay in view.
            className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="room-form-title" className="flex-none flex items-center gap-2 px-6 py-4 border-b border-line text-title-large text-ink">
              <span className="icon icon--24 text-primary" aria-hidden="true">
                {editing === "new" ? "add_business" : "edit_square"}
              </span>
              {editing === "new" ? "สร้างห้องใหม่" : `แก้ไขห้อง "${editing.name}"`}
            </h2>

            <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col" noValidate>
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">
                {formError && (
                  <div className="alert alert--error mb-4" role="alert">
                    <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-6">
                  <div className="md:col-span-4">
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

                  <div className="md:col-span-2">
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
                    <label htmlFor="room-price" className="field-label">ราคาค่าเช่า (บาท/ชม.) *</label>
                    <input
                      id="room-price"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={form.pricePerHour}
                      onChange={(e) => updateField("pricePerHour", e.target.value)}
                      className={fieldClass("pricePerHour")}
                      aria-invalid={!!formErrors.pricePerHour}
                    />
                    {errorText("pricePerHour")}
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-6">
                    <label htmlFor="room-admin" className="field-label">ผู้ดูแลห้อง *</label>
                    <Dropdown
                      id="room-admin"
                      value={form.roomAdminId}
                      onChange={(v) => updateField("roomAdminId", v)}
                      options={users.map((user) => ({ value: user.id, label: user.name, hint: user.email }))}
                      placeholder="เลือกผู้ดูแลห้อง"
                      searchPlaceholder="ค้นหาชื่อหรืออีเมล"
                      invalid={!!formErrors.roomAdminId}
                    />
                    {errorText("roomAdminId")}
                  </div>

                  <fieldset className="md:col-span-6">
                    <legend className="field-label">สิ่งอำนวยความสะดวก</legend>
                    <AmenityCheckboxes
                      selected={form.amenities}
                      onChange={(next) => updateField("amenities", next)}
                    />
                  </fieldset>

                  <div className="md:col-span-6">
                    <PhotoGuide
                      amenities={form.amenities}
                      cover={form.image}
                      onCoverChange={(url) => updateField("image", url)}
                      photos={form.photos}
                      onPhotoChange={(shot, url) => {
                        setForm((f) => ({ ...f, photos: { ...f.photos, [shot]: url } }));
                        setFormErrors((e) => ({ ...e, photos: undefined }));
                      }}
                    />
                    {errorText(formErrors.image ? "image" : "photos")}
                  </div>
                </div>

                <label className="checkbox pt-4">
                  <input
                    type="checkbox"
                    checked={form.status}
                    onChange={(e) => updateField("status", e.target.checked)}
                  />
                  เปิดให้จอง (ปิดแล้วห้องจะไม่แสดงในหน้าค้นหา)
                </label>
              </div>

              <div className="flex-none flex justify-end gap-3 px-6 py-4 border-t border-line">
                <button type="button" onClick={() => setEditing(null)} className="btn-text" disabled={isSaving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  <span className="icon icon--20" aria-hidden="true">save</span>
                  {isSaving ? "กำลังบันทึก..." : editing === "new" ? "สร้างห้อง" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RoomGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

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
