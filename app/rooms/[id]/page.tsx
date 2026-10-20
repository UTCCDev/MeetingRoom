"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import Dropdown from "@/app/components/Dropdown";
import DatePicker from "@/app/components/DatePicker";
import RoomGallery from "@/app/components/RoomGallery";
import { parseRoomPhotos } from "@/lib/room-photos";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import {
  addDays,
  addMinutes,
  amenityList,
  bangkokISO,
  formatDate,
  formatPricePerHour,
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
  pricePerHour: number;
  image?: string;
  amenities?: string;
  photos?: unknown;
  status: boolean;
  roomAdmin: {
    name: string;
    email: string;
  };
}

interface Booking {
  id: string;
  title?: string | null;
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

/** "2 ชม.", "1 ชม. 30 นาที", "30 นาที" between two "HH:MM" times. */
function durationLabel(from: string, to: string): string {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const total = Math.max(0, mins(to) - mins(from));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h && `${h} ชม.`, m && `${m} นาที`].filter(Boolean).join(" ") || "0 นาที";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  // Only takes space when there is an error, so fields keep the 24px form rhythm.
  if (!message) return null;
  return (
    <p id={id} className="field-error flex items-center gap-1" role="alert">
      <span className="icon icon--20" aria-hidden="true">error</span>
      {message}
    </p>
  );
}

function inputClass(invalid: boolean) {
  return `input-field ${invalid ? "border-error" : ""}`;
}

const SLOT_PERIODS = [
  { label: "ช่วงเช้า", icon: "wb_twilight", from: "07:00", to: "12:00" },
  { label: "ช่วงบ่าย", icon: "light_mode", from: "12:00", to: "17:00" },
  { label: "ช่วงเย็น", icon: "dark_mode", from: "17:00", to: "22:00" },
];

export default function RoomDetailPage() {
  const params = useParams();
  const roomId = params?.id as string;
  const { data: session } = useSession();
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
  // Grid range picking: the first click sets `anchor` (start), the next click sets the end.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [rangeNote, setRangeNote] = useState("");
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

  // A clicked slot stands for the hour starting there, shortened to 30 minutes when the
  // next half hour is taken (addMinutes also stops at 22:00).
  const blockEnd = (slot: string) => {
    const oneHour = addMinutes(slot, 60);
    return conflicts(slot, oneHour) ? addMinutes(slot, 30) : oneHour;
  };

  // Two clicks → from the earlier slot's start to the later slot's hour end.
  const rangeFor = (a: string, b: string) => {
    const [first, last] = a <= b ? [a, b] : [b, a];
    return { from: first, to: blockEnd(last) };
  };

  // Hover preview while waiting for the second click.
  const preview = anchor && hoverSlot && hoverSlot !== anchor ? rangeFor(anchor, hoverSlot) : null;
  const previewOk = !!preview && !conflicts(preview.from, preview.to);

  const slotState = (slot: string): "past" | "booked" | "selected" | "preview" | "free" => {
    if (isPast(slot)) return "past";
    if (conflicts(slot, addMinutes(slot, 30))) return "booked";
    if (previewOk && slot >= preview!.from && slot < preview!.to) return "preview";
    if (startTime && endTime && slot >= startTime && slot < endTime) return "selected";
    return "free";
  };

  const pickSlot = (slot: string) => {
    clearError("startTime");
    clearError("endTime");
    setRangeNote("");
    if (anchor && slot === anchor) {
      // Clicking the start again keeps that single hour and finishes.
      setAnchor(null);
      return;
    }
    if (anchor) {
      const range = rangeFor(anchor, slot);
      if (!conflicts(range.from, range.to)) {
        setStartTime(range.from);
        setEndTime(range.to);
        setAnchor(null);
        return;
      }
      setRangeNote("ช่วงนี้ทับการจองอื่น จึงเริ่มเลือกใหม่จากช่องที่คลิก");
    }
    setStartTime(slot);
    setEndTime(blockEnd(slot));
    setAnchor(slot);
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
    setAnchor(null);
    setStartTime(v);
    clearError("startTime");
    clearError("endTime");
    if (!v) return;
    if (endTime && endTime > v && !conflicts(v, endTime)) return;
    const oneHour = addMinutes(v, 60);
    setEndTime(conflicts(v, oneHour) ? addMinutes(v, 30) : oneHour);
  };

  const chooseDate = (d: string) => {
    setAnchor(null);
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
      <div className="min-h-screen bg-canvas ui-lg">
        <AppHeader title="กำลังโหลด…" breadcrumbs={[{ label: "ค้นหาห้อง", href: "/rooms" }]} />
        <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SkeletonCards count={2} />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-canvas ui-lg">
        <AppHeader title="ไม่พบห้อง" breadcrumbs={[{ label: "ค้นหาห้อง", href: "/rooms" }]} />
        <div className="p-8 text-center">
          <div className="empty-state">
            <span className="icon icon--40 text-ink-subtle" aria-hidden="true">search_off</span>
            <p>{error || "ไม่พบห้องนี้"}</p>
            <Link href="/rooms" className="btn-secondary">
              <span className="icon icon--20" aria-hidden="true">arrow_back</span>
              กลับไปค้นหาห้อง
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const amenitiesList = amenityList(room.amenities);
  const location = roomLocation(room.description);
  const attendeesMessage = fieldErrors.attendees || attendeesError(attendees, false);

  return (
    <div className="min-h-screen bg-canvas ui-lg">
      <AppHeader
        title={room.name}
        breadcrumbs={[{ label: "ค้นหาห้อง", href: "/rooms" }, { label: room.name }]}
      />

      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-0 sm:p-0 overflow-hidden">
              <RoomGallery
                room={{ id: room.id, name: room.name, capacity: room.capacity, amenities: amenitiesList, image: room.image, photos: parseRoomPhotos(room.photos) }}
              />
              <div className="p-4 sm:p-6">
                {/* Room facts as aligned rows: icon + label column, value column (min-h keeps first lines level). */}
                <dl className="rounded-md bg-canvas ring-1 ring-line divide-y divide-line">
                  {[
                    location && {
                      icon: "location_on",
                      label: "สถานที่",
                      value: <span className="text-ink">{location}</span>,
                    },
                    {
                      icon: "group",
                      label: "จำนวนที่นั่ง",
                      value: (
                        <span className="text-ink">
                          <strong className="font-medium tabular-nums">{room.capacity}</strong> คน
                        </span>
                      ),
                    },
                    {
                      icon: "payments",
                      label: "ราคาค่าเช่า",
                      value: <span className="text-ink">{formatPricePerHour(room.pricePerHour)}</span>,
                    },
                    {
                      icon: "person",
                      label: "ผู้ดูแลห้อง",
                      value: (
                        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="text-ink">{room.roomAdmin.name}</span>
                          {room.roomAdmin.email && (
                            <a
                              href={`mailto:${room.roomAdmin.email}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                            >
                              <span className="icon icon--20" aria-hidden="true">mail</span>
                              {room.roomAdmin.email}
                            </a>
                          )}
                        </span>
                      ),
                    },
                    amenitiesList.length > 0 && {
                      icon: "devices",
                      label: "อุปกรณ์ในห้อง",
                      value: (
                        <span className="flex flex-wrap gap-2">
                          {amenitiesList.map((amenity: string) => (
                            <span key={amenity} className="badge-primary">
                              <span className="icon icon--20" aria-hidden="true">check</span>
                              {AMENITY_LABELS[amenity] || amenity}
                            </span>
                          ))}
                        </span>
                      ),
                    },
                  ]
                    .filter((row): row is { icon: string; label: string; value: React.ReactElement } => !!row)
                    .map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-1 sm:grid-cols-[11rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3"
                      >
                        <dt className="flex items-center gap-2 min-h-7 text-body-medium text-ink-subtle">
                          <span className="icon icon--20 text-primary self-center" aria-hidden="true">{row.icon}</span>
                          {row.label}
                        </dt>
                        <dd className="flex items-center min-h-7 text-body-large">{row.value}</dd>
                      </div>
                    ))}
                </dl>

              </div>
            </div>

            {/* Day schedule */}
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="flex items-center gap-2 text-headline-small text-ink">
                  <span className="icon icon--24 text-primary" aria-hidden="true">calendar_month</span>
                  ตารางห้องรายวัน
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => date > todayKey() && chooseDate(addDays(date, -1))}
                    disabled={date <= todayKey()}
                    className="icon-button"
                    aria-label="วันก่อนหน้า"
                  >
                    <span className="icon icon--24" aria-hidden="true">chevron_left</span>
                  </button>
                  <span className="text-title-small text-ink min-w-[9rem] text-center">{formatDate(bangkokISO(date, "12:00"))}</span>
                  <button
                    type="button"
                    onClick={() => date < MAX_DATE && chooseDate(addDays(date, 1))}
                    className="icon-button"
                    aria-label="วันถัดไป"
                  >
                    <span className="icon icon--24" aria-hidden="true">chevron_right</span>
                  </button>
                </div>
              </div>

              <p className="text-body-small text-ink-subtle mb-3">
                คลิกช่องแรกเป็นเวลาเริ่ม แล้วคลิกอีกช่องเป็นเวลาสิ้นสุด (แต่ละช่องนับ 1 ชั่วโมงจากเวลานั้น)
              </p>
              {/* Slots grouped into morning / afternoon / evening (10 half-hour slots each), so a long
                  run of identical pills becomes three short rows that are easy to scan. */}
              <div className="space-y-5" onMouseLeave={() => setHoverSlot(null)}>
                {SLOT_PERIODS.map((period) => {
                  const slots = TIME_SLOTS.filter((t) => t >= period.from && t < period.to);
                  const freeCount = slots.filter((t) => slotState(t) === "free").length;
                  return (
                    <section key={period.label} aria-label={`${period.label} ${period.from}–${period.to}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="icon icon--24 text-primary" aria-hidden="true">{period.icon}</span>
                        <h3 className="text-title-medium text-ink">{period.label}</h3>
                        <span className="text-body-small text-ink-subtle tabular-nums">{period.from}–{period.to}</span>
                        <span className="ml-auto text-label-large text-ink-muted tabular-nums">
                          {freeCount ? `ว่าง ${freeCount} ช่อง` : "ไม่มีช่องว่าง"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {slots.map((slot) => {
                          const state = slotState(slot);
                          const cls = {
                            past: "bg-surface-variant text-disabled-fg border-transparent cursor-not-allowed",
                            booked: "bg-error-container text-on-error-container border-transparent cursor-not-allowed",
                            selected: "bg-primary text-on-primary border-primary",
                            preview: "bg-primary-container text-on-primary-container border-primary",
                            free: "bg-surface text-ink border-outline hover:border-primary hover:bg-primary-99",
                          }[state];
                          // A short word under the time so every slot's state reads clearly, not just from
                          // colour (most slots are free, so it must show there too or a change goes unnoticed).
                          const stateLabel = {
                            past: "เลยเวลาแล้ว",
                            booked: "ไม่ว่าง",
                            selected: "ที่เลือก",
                            preview: "กำลังเลือก",
                            free: "ว่าง",
                          }[state];
                          const stateIcon = {
                            past: "history",
                            booked: "block",
                            selected: "check_circle",
                            preview: "radio_button_checked",
                            free: "",
                          }[state];
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={state === "past" || state === "booked"}
                              onClick={() => pickSlot(slot)}
                              onMouseEnter={() => setHoverSlot(slot)}
                              onFocus={() => setHoverSlot(slot)}
                              className={`group rounded-sm border px-2.5 sm:px-3 py-2.5 flex flex-col items-start gap-1 text-left transition-colors ${cls} ${
                                slot === anchor ? "ring-2 ring-offset-2 ring-primary" : ""
                              }`}
                              aria-label={`${slot} ${state === "booked" ? "ไม่ว่าง" : state === "past" ? "เลยเวลาแล้ว" : "ว่าง"}`}
                              aria-pressed={state === "selected"}
                            >
                              <span className={`text-title-medium tabular-nums leading-none ${state === "past" ? "line-through decoration-1" : ""}`}>
                                {slot}
                              </span>
                              <span
                                className={`flex items-center gap-1 text-label-large leading-none ${
                                  state === "free" ? "text-success" : ""
                                }`}
                              >
                                {state === "free" ? (
                                  <span className="w-2 h-2 rounded-full bg-success-50" aria-hidden="true" />
                                ) : (
                                  <span className="icon !text-[16px] hidden min-[400px]:inline" aria-hidden="true">{stateIcon}</span>
                                )}
                                {stateLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
              {/* What's picked, its length, and what the next click does. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 min-h-11 px-4 py-2 rounded-sm bg-canvas border border-line" aria-live="polite">
                {startTime && endTime ? (
                  <>
                    <span className="icon icon--20 text-primary" aria-hidden="true">schedule</span>
                    <span className="text-title-small text-ink tabular-nums">
                      {(previewOk ? preview!.from : startTime)}–{(previewOk ? preview!.to : endTime)}
                    </span>
                    <span className="badge-primary tabular-nums">
                      {durationLabel(previewOk ? preview!.from : startTime, previewOk ? preview!.to : endTime)}
                    </span>
                    <span className="text-body-small text-ink-subtle">
                      {anchor ? "คลิกช่องเวลาสิ้นสุด หรือส่งคำขอได้เลย" : "คลิกช่องใหม่เพื่อเลือกช่วงเวลาใหม่"}
                    </span>
                  </>
                ) : (
                  <span className="text-body-small text-ink-subtle">ยังไม่ได้เลือกเวลา</span>
                )}
                {rangeNote && <span className="w-full text-body-medium text-on-highlight-container">{rangeNote}</span>}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-body-small text-ink-subtle">
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-surface border border-outline" /> ว่าง</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-error-container" /> ไม่ว่าง</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-primary" /> ที่เลือก</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-surface-variant" /> เลยเวลาแล้ว</span>
              </div>

              {dayBookings.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {dayBookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 rounded-sm border border-line bg-canvas text-body-medium"
                    >
                      <span className="icon icon--20 text-ink-subtle" aria-hidden="true">schedule</span>
                      <span className="text-title-small text-ink tabular-nums">{formatRange(booking.startTime, booking.endTime)}</span>
                      <span className="text-ink-muted flex-1 min-w-0 truncate">{booking.title || "มีการจองแล้ว"}</span>
                      <span className={booking.status === "APPROVED" ? "badge-available" : "badge-pending"}>
                        {booking.status === "APPROVED" ? "อนุมัติแล้ว" : "รอการตัดสินใจ"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="card card--elevated h-fit lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-headline-small text-ink mb-5">
              <span className="icon icon--24 text-primary" aria-hidden="true">edit_calendar</span>
              จองห้องนี้
            </h2>

            {!room.status && (
              <div className="alert alert--info mb-4">
                <span className="icon icon--24 text-primary" aria-hidden="true">block</span>
                ห้องนี้ปิดใช้งานอยู่ ไม่สามารถจองได้
              </div>
            )}

            {error && (
              <div className="alert alert--error mb-4" role="alert">
                <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
                {error}
              </div>
            )}

            {!session ? (
              <div className="text-center py-6">
                <span className="icon icon--40 text-primary mb-3 inline-block" aria-hidden="true">login</span>
                <p className="text-body-medium text-ink-muted mb-5">
                  เข้าสู่ระบบเพื่อส่งคำขอจองห้องนี้ ระบบจะพากลับมาที่หน้านี้ให้หลังเข้าสู่ระบบสำเร็จ
                </p>
                <Link
                  href={`/auth/login?callbackUrl=${encodeURIComponent("/rooms/" + roomId)}`}
                  className="btn-primary w-full h-[52px] px-[34px] text-title-medium justify-center"
                >
                  <span className="icon icon--24" aria-hidden="true">login</span>
                  เข้าสู่ระบบเพื่อจอง
                </Link>
              </div>
            ) : (
            <form onSubmit={handleBooking} className="space-y-6" noValidate>
              <div>
                <label htmlFor="booking-title" className="field-label">
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
                <label htmlFor="booking-description" className="field-label">
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
                <label htmlFor="booking-attendees" className="field-label">
                  จำนวนผู้เข้าร่วม * <span className="text-ink-subtle font-normal">(ห้องจุ {room.capacity} คน)</span>
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
                <label htmlFor="booking-date" className="field-label">
                  วันที่ *
                </label>
                <DatePicker
                  id="booking-date"
                  value={date}
                  onChange={chooseDate}
                  min={todayKey()}
                  max={MAX_DATE}
                  invalid={!!fieldErrors.date}
                  aria-describedby="booking-date-error"
                />
                <FieldError id="booking-date-error" message={fieldErrors.date} />
              </div>

              <div className="grid grid-cols-2 gap-3 -mb-2">
                <div>
                  <label htmlFor="booking-start" className="field-label">
                    เริ่ม *
                  </label>
                  <Dropdown
                    id="booking-start"
                    value={startTime}
                    onChange={chooseStart}
                    options={[
                      { value: "", label: "--:--" },
                      ...TIME_SLOTS.map((t) => {
                        const state = slotState(t);
                        return {
                          value: t,
                          label: `${t}${state === "booked" ? " (ไม่ว่าง)" : state === "past" ? " (ผ่านแล้ว)" : ""}`,
                          disabled: state === "past" || state === "booked",
                        };
                      }),
                    ]}
                    searchable={false}
                    className="tabular-nums"
                    invalid={!!fieldErrors.startTime}
                    aria-describedby="booking-time-error"
                  />
                </div>
                <div>
                  <label htmlFor="booking-end" className="field-label">
                    สิ้นสุด *
                  </label>
                  <Dropdown
                    id="booking-end"
                    value={endTime}
                    onChange={(v) => {
                      setAnchor(null);
                      setEndTime(v);
                      clearError("endTime");
                    }}
                    options={[
                      { value: "", label: "--:--" },
                      ...END_SLOTS.filter((t) => !startTime || t > startTime).map((t) => {
                        // Can't run into the next booking.
                        const blocked = !!startTime && conflicts(startTime, t);
                        return { value: t, label: `${t}${blocked ? " (ชนการจอง)" : ""}`, disabled: blocked };
                      }),
                    ]}
                    searchable={false}
                    className="tabular-nums"
                    invalid={!!fieldErrors.endTime}
                    aria-describedby="booking-time-error"
                  />
                </div>
              </div>
              <FieldError id="booking-time-error" message={fieldErrors.startTime || fieldErrors.endTime} />
              {startTime && endTime > startTime && (
                <p className="field-hint -mt-4 flex items-center gap-2">
                  <span className="icon icon--20" aria-hidden="true">timelapse</span>
                  ระยะเวลา {durationLabel(startTime, endTime)}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !room.status}
                className="w-full btn-primary h-[52px] px-[34px] text-title-medium"
              >
                <span className="icon icon--24" aria-hidden="true">send</span>
                {isSubmitting ? "กำลังจอง..." : "ส่งคำขอจอง"}
              </button>
              <p className="text-body-small text-ink-subtle text-center">
                การจองจะรอการอนุมัติจากผู้ดูแลห้อง
              </p>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
