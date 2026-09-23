"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import {
  addDays,
  addMinutes,
  bangkokISO,
  formatDate,
  formatRange,
  roomLocation,
  TIME_SLOTS,
  toDateKey,
  todayKey,
} from "@/lib/format";

interface Room {
  id: string;
  name: string;
  description: string;
  capacity: number;
  image?: string;
  amenities?: string;
  status: boolean;
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

type Field = "title" | "attendees" | "date" | "startTime" | "endTime";

const AMENITY_LABELS: Record<string, string> = {
  projector: "โปรเจกเตอร์",
  whiteboard: "กระดานไวท์บอร์ด",
  videoconference: "ระบบวิดีโอคอนเฟอเรนซ์",
  printer: "เครื่องพิมพ์",
  tv: "โทรทัศน์ / จอมอนิเตอร์",
  microphone: "ไมโครโฟน",
};

const END_SLOTS = [...TIME_SLOTS.slice(1), "22:00"];
const MAX_DATE = addDays(todayKey(), 365);

function FieldError({ id, message }: { id: string; message?: string }) {
  // Space is always reserved so an error doesn't push the submit button around.
  return (
    <p id={id} className="text-xs text-red-600 mt-1 min-h-[1rem]" role={message ? "alert" : undefined}>
      {message || ""}
    </p>
  );
}

function inputClass(invalid: boolean) {
  return `input-field ${invalid ? "border-red-500 focus:ring-red-500" : ""}`;
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
  const [date, setDate] = useState(todayKey());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const router = useRouter();
  const toast = useToast();

  // Prefill from the room search filters (?date=&start=&end=).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const d = qs.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayKey()) setDate(d);
    if (qs.get("start") && TIME_SLOTS.includes(qs.get("start")!)) setStartTime(qs.get("start")!);
    if (qs.get("end") && END_SLOTS.includes(qs.get("end")!)) setEndTime(qs.get("end")!);
  }, []);

  useEffect(() => {
    if (roomId) {
      fetchRoomDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (!response.ok) throw new Error("Failed to fetch room");
      const data = await response.json();
      setRoom(data);
      await fetchBookings();
    } catch (err) {
      setError("ไม่สามารถโหลดรายละเอียดห้องได้");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBookings = async () => {
    const res = await fetch(`/api/rooms/${roomId}/bookings`).catch(() => null);
    if (res?.ok) setBookings(await res.json());
  };

  // Editing a field clears that field's error (and the general banner).
  const clearError = (field: Field) => {
    setError("");
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const dayBookings = useMemo(
    () => bookings.filter((b) => toDateKey(b.startTime) <= date && toDateKey(b.endTime) >= date),
    [bookings, date]
  );

  const isPast = (slot: string, day = date) => new Date(bangkokISO(day, slot)) <= new Date();

  // Same overlap rule as the server: existing.start < end AND existing.end > start.
  const conflicts = (from: string, to: string, day = date) => {
    const start = new Date(bangkokISO(day, from));
    const end = new Date(bangkokISO(day, to));
    return bookings.some((b) => new Date(b.startTime) < end && new Date(b.endTime) > start);
  };

  const slotState = (slot: string): "past" | "booked" | "selected" | "free" => {
    if (isPast(slot)) return "past";
    if (conflicts(slot, addMinutes(slot, 30))) return "booked";
    if (startTime && endTime && slot >= startTime && slot < endTime) return "selected";
    return "free";
  };

  const pickSlot = (slot: string) => {
    setStartTime(slot);
    // One hour by default, shortened if the next half hour is taken.
    const oneHour = addMinutes(slot, 60);
    setEndTime(conflicts(slot, oneHour) ? addMinutes(slot, 30) : oneHour);
    clearError("startTime");
    clearError("endTime");
  };

  const attendeesError = (value: string, required: boolean): string | undefined => {
    if (!room) return undefined;
    if (value === "") return required ? "กรุณาระบุจำนวนผู้เข้าร่วม" : undefined;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) return "จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มตั้งแต่ 1 คน";
    if (count > room.capacity) return `เกินความจุห้อง (สูงสุด ${room.capacity} คน)`;
    return undefined;
  };

  // Picking a start time: keep a valid end, default to one hour, and stop
  // before the next booking.
  const chooseStart = (v: string) => {
    setStartTime(v);
    clearError("startTime");
    clearError("endTime");
    if (!v) return;
    if (endTime && endTime > v && !conflicts(v, endTime)) return;
    const oneHour = addMinutes(v, 60);
    setEndTime(conflicts(v, oneHour) ? addMinutes(v, 30) : oneHour);
  };

  const chooseDate = (d: string) => {
    setDate(d);
    clearError("date");
    clearError("startTime");
    clearError("endTime");
    // Drop a time that is no longer valid on the new day.
    if (startTime && /^\d{4}-\d{2}-\d{2}$/.test(d) && (isPast(startTime, d) || (endTime && conflicts(startTime, endTime, d)))) {
      setStartTime("");
      setEndTime("");
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!room) return;

    const errors: Partial<Record<Field, string>> = {};
    const count = Number(attendees);
    if (!title.trim()) errors.title = "กรุณากรอกชื่อเรื่องการประชุม";
    const attendeesMsg = attendeesError(attendees, true);
    if (attendeesMsg) errors.attendees = attendeesMsg;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "กรุณาเลือกวันที่";
    else if (date < todayKey() || date > MAX_DATE) errors.date = "เลือกได้ตั้งแต่วันนี้ถึง 1 ปีข้างหน้า";
    if (!startTime) errors.startTime = "กรุณาเลือกเวลาเริ่มต้น";
    if (!endTime) errors.endTime = "กรุณาเลือกเวลาสิ้นสุด";
    if (startTime && endTime && endTime <= startTime) {
      errors.endTime = "เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น";
    }
    if (!errors.date && startTime && isPast(startTime)) {
      errors.startTime = "เวลาเริ่มผ่านไปแล้ว กรุณาเลือกเวลาในอนาคต";
    } else if (!errors.date && !errors.endTime && startTime && endTime && conflicts(startTime, endTime)) {
      errors.startTime = "ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกเวลาอื่น";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          title: title.trim(),
          description,
          attendees: count,
          // Explicit +07:00 offset so the server never guesses the timezone.
          startTime: bangkokISO(date, startTime),
          endTime: bangkokISO(date, endTime),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.error || "ไม่สามารถสร้างการจองได้";
        if (data.field && ["title", "attendees", "startTime", "endTime"].includes(data.field)) {
          setFieldErrors({ [data.field]: message });
        } else {
          setError(message);
        }
        if (response.status === 409) fetchBookings();
        return;
      }

      toast("ส่งคำขอจองแล้ว รอการอนุมัติจากผู้ดูแลห้อง", { type: "success" });
      router.push("/my-bookings");
    } catch (err) {
      setError("ไม่สามารถสร้างการจองได้ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader title="กำลังโหลด…" breadcrumbs={[{ label: "ค้นหาห้อง", href: "/rooms" }]} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <SkeletonCards count={2} />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader title="ไม่พบห้อง" breadcrumbs={[{ label: "ค้นหาห้อง", href: "/rooms" }]} />
        <div className="p-8 text-center">
          <p className="text-red-600 mb-4">{error || "ไม่พบห้องนี้"}</p>
          <Link href="/rooms" className="btn-secondary inline-block">กลับไปค้นหาห้อง</Link>
        </div>
      </div>
    );
  }

  const amenitiesList = Array.isArray(room.amenities) ? room.amenities : [];
  const location = roomLocation(room.description);
  const attendeesMessage = fieldErrors.attendees || attendeesError(attendees, false);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader
        title={room.name}
        breadcrumbs={[{ label: "ค้นหาห้อง", href: "/rooms" }, { label: room.name }]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="card">
              {room.image && (
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-64 object-cover rounded-lg mb-6"
                />
              )}
              {location && <p className="text-gray-700 font-medium mb-4">📍 {location}</p>}

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2 text-sm">
                <div>
                  <dt className="text-gray-500">จำนวนที่นั่ง</dt>
                  <dd className="font-semibold text-gray-800">{room.capacity} คน</dd>
                </div>
                <div>
                  <dt className="text-gray-500">ผู้ดูแลห้อง</dt>
                  <dd className="font-semibold text-gray-800">{room.roomAdmin.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">อีเมล</dt>
                  <dd className="font-semibold text-gray-800 break-all">{room.roomAdmin.email}</dd>
                </div>
              </dl>

              {amenitiesList.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-bold mb-2">สิ่งอำนวยความสะดวก:</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenitiesList.map((amenity: string) => (
                      <span
                        key={amenity}
                        className="text-white px-3 py-1 rounded-full text-sm bg-blue-700"
                      >
                        {AMENITY_LABELS[amenity] || amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Day schedule */}
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-blue-700">ตารางห้องรายวัน</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => date > todayKey() && chooseDate(addDays(date, -1))}
                    disabled={date <= todayKey()}
                    className="w-9 h-9 rounded-lg border border-gray-300 disabled:opacity-40"
                    aria-label="วันก่อนหน้า"
                  >
                    ‹
                  </button>
                  <span className="font-medium min-w-[9rem] text-center">{formatDate(bangkokISO(date, "12:00"))}</span>
                  <button
                    type="button"
                    onClick={() => date < MAX_DATE && chooseDate(addDays(date, 1))}
                    className="w-9 h-9 rounded-lg border border-gray-300"
                    aria-label="วันถัดไป"
                  >
                    ›
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-3">คลิกช่องว่างเพื่อเลือกเวลาในฟอร์มจอง</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                {TIME_SLOTS.map((slot) => {
                  const state = slotState(slot);
                  const cls = {
                    past: "bg-gray-100 text-gray-400 cursor-not-allowed",
                    booked: "bg-rose-100 text-rose-700 cursor-not-allowed",
                    selected: "bg-blue-700 text-white",
                    free: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200",
                  }[state];
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={state === "past" || state === "booked"}
                      onClick={() => pickSlot(slot)}
                      className={`rounded py-2 text-xs font-medium ${cls}`}
                      aria-label={`${slot} ${state === "booked" ? "ไม่ว่าง" : state === "past" ? "เลยเวลาแล้ว" : "ว่าง"}`}
                      aria-pressed={state === "selected"}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> ว่าง</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100" /> ไม่ว่าง</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-700" /> ที่เลือก</span>
              </div>

              {dayBookings.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {dayBookings.map((booking) => (
                    <li
                      key={booking.id}
                      className={`p-3 rounded border text-sm ${
                        booking.status === "APPROVED"
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <span className="font-medium">{booking.title}</span>
                      <span className="text-gray-600"> · {formatRange(booking.startTime, booking.endTime)}</span>
                      <span className={`ml-2 text-xs font-medium ${booking.status === "APPROVED" ? "text-emerald-600" : "text-amber-600"}`}>
                        {booking.status === "APPROVED" ? "อนุมัติแล้ว" : "รอการตัดสินใจ"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="card h-fit lg:sticky lg:top-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">จองห้องนี้</h2>

            {!room.status && (
              <div className="mb-4 p-3 bg-gray-100 text-gray-700 rounded text-sm">ห้องนี้ปิดใช้งานอยู่ ไม่สามารถจองได้</div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm" role="alert">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-3" noValidate>
              <div>
                <label htmlFor="booking-title" className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อเรื่องการประชุม *
                </label>
                <input
                  id="booking-title"
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearError("title");
                  }}
                  className={inputClass(!!fieldErrors.title)}
                  placeholder="เช่น ประชุมทีมงาน"
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby="booking-title-error"
                />
                <FieldError id="booking-title-error" message={fieldErrors.title} />
              </div>

              <div>
                <label htmlFor="booking-description" className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  id="booking-description"
                  value={description}
                  maxLength={2000}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field"
                  placeholder="รายละเอียดของการประชุม..."
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="booking-attendees" className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนผู้เข้าร่วม * <span className="text-gray-500 font-normal">(ห้องจุ {room.capacity} คน)</span>
                </label>
                <input
                  id="booking-attendees"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={attendees}
                  onChange={(e) => {
                    // Digits only: blocks "-3", "1.5" and "1e3" at the source.
                    setAttendees(e.target.value.replace(/\D/g, "").slice(0, 4));
                    clearError("attendees");
                  }}
                  className={inputClass(!!attendeesMessage)}
                  aria-invalid={!!attendeesMessage}
                  aria-describedby="booking-attendees-error"
                />
                <FieldError
                  id="booking-attendees-error"
                  message={attendeesMessage}
                />
              </div>

              <div>
                <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ *
                </label>
                <input
                  id="booking-date"
                  type="date"
                  min={todayKey()}
                  max={MAX_DATE}
                  value={date}
                  onChange={(e) => chooseDate(e.target.value)}
                  className={inputClass(!!fieldErrors.date)}
                  aria-invalid={!!fieldErrors.date}
                  aria-describedby="booking-date-error"
                />
                <FieldError id="booking-date-error" message={fieldErrors.date} />
              </div>

              <div className="grid grid-cols-2 gap-3 -mb-2">
                <div>
                  <label htmlFor="booking-start" className="block text-sm font-medium text-gray-700 mb-1">
                    เริ่ม *
                  </label>
                  <select
                    id="booking-start"
                    value={startTime}
                    onChange={(e) => chooseStart(e.target.value)}
                    className={inputClass(!!fieldErrors.startTime)}
                    aria-invalid={!!fieldErrors.startTime}
                    aria-describedby="booking-time-error"
                  >
                    <option value="">--:--</option>
                    {TIME_SLOTS.map((t) => {
                      const state = slotState(t);
                      const unavailable = state === "past" || state === "booked";
                      return (
                        <option key={t} value={t} disabled={unavailable}>
                          {t}{state === "booked" ? " (ไม่ว่าง)" : state === "past" ? " (ผ่านแล้ว)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label htmlFor="booking-end" className="block text-sm font-medium text-gray-700 mb-1">
                    สิ้นสุด *
                  </label>
                  <select
                    id="booking-end"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      clearError("endTime");
                    }}
                    className={inputClass(!!fieldErrors.endTime)}
                    aria-invalid={!!fieldErrors.endTime}
                    aria-describedby="booking-time-error"
                  >
                    <option value="">--:--</option>
                    {END_SLOTS.filter((t) => !startTime || t > startTime).map((t) => {
                      // Can't run into the next booking.
                      const blocked = !!startTime && conflicts(startTime, t);
                      return (
                        <option key={t} value={t} disabled={blocked}>
                          {t}{blocked ? " (ชนการจอง)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <FieldError id="booking-time-error" message={fieldErrors.startTime || fieldErrors.endTime} />

              <button
                type="submit"
                disabled={isSubmitting || !room.status}
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
