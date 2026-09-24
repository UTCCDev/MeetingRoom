"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { roomCover } from "@/app/components/RoomGallery";
import { SkeletonCards } from "@/app/components/Skeleton";
import { addMinutes, bangkokISO, roomLocation, TIME_SLOTS, todayKey } from "@/lib/format";

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
  bookings: { startTime: string; endTime: string; status: string }[];
}

const END_SLOTS = [...TIME_SLOTS.slice(1), "22:00"];

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const minSeats = Math.max(parseInt(minCapacity, 10) || 0, 0);

  // Availability filter applies once a date and both times are chosen.
  const window_ =
    date && startTime && endTime && endTime > startTime
      ? { start: new Date(bangkokISO(date, startTime)), end: new Date(bangkokISO(date, endTime)) }
      : null;

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const matchesSearch =
          !normalizedSearch ||
          room.name.toLowerCase().includes(normalizedSearch) ||
          (room.description || "").toLowerCase().includes(normalizedSearch) ||
          room.roomAdmin.name.toLowerCase().includes(normalizedSearch);

        const matchesCapacity = !minSeats || room.capacity >= minSeats;

        const isFree =
          !window_ ||
          !room.bookings.some(
            (b) => new Date(b.startTime) < window_.end && new Date(b.endTime) > window_.start
          );

        return matchesSearch && matchesCapacity && isFree;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooms, normalizedSearch, minSeats, date, startTime, endTime]
  );

  const hasFilters = !!(searchTerm || minCapacity || date || startTime || endTime);

  const clearFilters = () => {
    setSearchTerm("");
    setMinCapacity("");
    setDate("");
    setStartTime("");
    setEndTime("");
  };

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

  const bookingHref = (roomId: string) => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (startTime) params.set("start", startTime);
    if (endTime) params.set("end", endTime);
    const qs = params.toString();
    return `/rooms/${roomId}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="ค้นหาห้องประชุม" breadcrumbs={[{ label: "ค้นหาห้อง" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search & Filter Section */}
        <section className="card mb-6 space-y-5" aria-label="ค้นหาและกรองห้อง">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label htmlFor="room-search" className="block text-label-large text-ink mb-2">
                คำค้นหา
              </label>
              <div className="relative">
                <span
                  className="icon icon--20 icon--w300 absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
                  aria-hidden="true"
                >
                  search
                </span>
                <input
                  id="room-search"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ชื่อห้อง, อาคาร, หน่วยงาน หรือผู้ดูแลห้อง"
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="room-min-capacity" className="block text-label-large text-ink mb-2">
                ที่นั่งขั้นต่ำ
              </label>
              <div className="relative">
                <span
                  className="icon icon--20 icon--w300 absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
                  aria-hidden="true"
                >
                  group
                </span>
                <input
                  id="room-min-capacity"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={minCapacity}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Negative or zero seat counts make no sense; clamp to 1.
                    setMinCapacity(v === "" ? "" : String(Math.max(1, parseInt(v, 10) || 1)));
                  }}
                  placeholder="เช่น 10"
                  className="input-field pl-10 tabular-nums"
                />
              </div>
            </div>
          </div>

          <fieldset className="flex gap-4 flex-wrap items-end pt-5 border-t border-line">
            <legend className="float-left w-full text-label-large text-ink mb-2">ห้องที่ว่างในช่วงเวลา</legend>
            <div className="w-full sm:w-48">
              <label htmlFor="room-date" className="block text-label-medium text-ink-subtle mb-1">วันที่</label>
              <input
                id="room-date"
                type="date"
                min={todayKey()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="w-[calc(50%-0.5rem)] sm:w-36">
              <label htmlFor="room-start" className="block text-label-medium text-ink-subtle mb-1">ตั้งแต่</label>
              <select
                id="room-start"
                value={startTime}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartTime(v);
                  if (v && (!endTime || endTime <= v)) setEndTime(addMinutes(v, 60));
                }}
                className="input-field tabular-nums"
              >
                <option value="">--:--</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="w-[calc(50%-0.5rem)] sm:w-36">
              <label htmlFor="room-end" className="block text-label-medium text-ink-subtle mb-1">ถึง</label>
              <select
                id="room-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-field tabular-nums"
              >
                <option value="">--:--</option>
                {END_SLOTS.filter((t) => !startTime || t > startTime).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {(date || startTime) && !window_ && (
              <p className="w-full flex items-center gap-2 text-body-small text-ink-muted">
                <span className="icon icon--20 icon--w300 text-primary" aria-hidden="true">info</span>
                เลือกวันที่ เวลาเริ่ม และเวลาสิ้นสุด เพื่อกรองเฉพาะห้องที่ว่าง
              </p>
            )}
          </fieldset>

          <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-line">
            <p className="text-body-small text-ink-muted" aria-live="polite">
              {!isLoading && (
                <>
                  พบ <strong className="font-bold text-ink tabular-nums">{filteredRooms.length}</strong> ห้อง
                  {window_ && " ที่ว่างในช่วงเวลาที่เลือก"}
                </>
              )}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 h-11 px-4 -mr-4 rounded-full text-label-large text-primary hover:bg-primary-container"
              >
                <span className="icon icon--20 icon--w500" aria-hidden="true">filter_alt_off</span>
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </section>

        {error && (
          <div
            className="alert alert--error mb-6"
            role="alert"
          >
            <span className="icon icon--24 icon--w500 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" />
        ) : rooms.length === 0 ? (
          <div className="empty-state">
            <span className="icon icon--40 icon--w300 text-ink-subtle" aria-hidden="true">meeting_room</span>
            <p>ยังไม่มีห้องประชุมในระบบ</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="empty-state">
            <span className="icon icon--40 icon--w300 text-ink-subtle" aria-hidden="true">search_off</span>
            <p className="mb-2">ไม่พบห้องที่ตรงกับเงื่อนไข</p>
            <button type="button" onClick={clearFilters} className="btn-secondary">
              <span className="icon icon--20 icon--w500" aria-hidden="true">filter_alt_off</span>
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => (
              <Link
                key={room.id}
                href={bookingHref(room.id)}
                className="card card--interactive group p-0 sm:p-0 overflow-hidden h-full flex flex-col"
              >
                <div className="relative aspect-video card__media overflow-hidden">
                  <img
                    src={roomCover(room)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                  />
                  {!room.image && (
                    <span className="absolute top-3 right-3 px-3 py-2 rounded-full bg-ink/70 text-white text-label-medium">
                      ภาพตัวอย่าง
                    </span>
                  )}
                  {window_ && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 py-2 pl-2.5 pr-3.5 rounded-full bg-white text-label-medium text-success shadow-sm">
                      <span className="icon icon--20 icon--w500 icon--fill" aria-hidden="true">check_circle</span>
                      ว่างช่วงนี้
                    </span>
                  )}
                </div>

                <div className="p-4 sm:p-6 flex-1 flex flex-col">
                  <h2 className="card__title mb-1 line-clamp-2 group-hover:text-primary">{room.name}</h2>
                  <p className="card__body icon-lead gap-2 mb-4 text-ink-subtle">
                    <span className="icon icon--20 icon--w300" aria-hidden="true">location_on</span>
                    <span className="line-clamp-2">{roomLocation(room.description)}</span>
                  </p>

                  <dl className="flex flex-wrap gap-x-5 gap-y-2 mb-5 text-body-small text-ink-muted">
                    <div className="flex items-center gap-2">
                      <dt className="flex">
                        <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">group</span>
                        <span className="sr-only">ความจุ</span>
                      </dt>
                      <dd>
                        <span className="font-medium text-ink tabular-nums">{room.capacity}</span> ที่นั่ง
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="flex">
                        <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">person</span>
                        <span className="sr-only">ผู้ดูแลห้อง</span>
                      </dt>
                      <dd>{room.roomAdmin.name}</dd>
                    </div>
                  </dl>

                </div>
                <span className="card__footer px-4 sm:px-6 h-12 flex items-center justify-between text-label-large text-primary">
                  {window_ ? "จองช่วงเวลานี้" : "ดูรายละเอียดและจอง"}
                  <span
                    className="icon icon--20 icon--w500 transition-transform duration-100 group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
