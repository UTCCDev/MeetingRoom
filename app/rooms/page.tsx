"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
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
    <div className="min-h-screen bg-white">
      <AppHeader title="ค้นหาห้องประชุม" breadcrumbs={[{ label: "ค้นหาห้อง" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search & Filter Section */}
        <div className="mb-6 p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label htmlFor="room-search" className="block text-sm font-medium text-gray-700 mb-1">
                คำค้นหา
              </label>
              <input
                id="room-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อห้อง, อาคาร, หน่วยงาน หรือผู้ดูแลห้อง"
                className="input-field"
              />
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="room-min-capacity" className="block text-sm font-medium text-gray-700 mb-1">
                ที่นั่งขั้นต่ำ
              </label>
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
                className="input-field"
              />
            </div>
          </div>

          <fieldset className="flex gap-4 flex-wrap items-end">
            <legend className="text-sm font-medium text-gray-700 mb-1">ห้องที่ว่างในช่วงเวลา</legend>
            <div className="w-full sm:w-48">
              <label htmlFor="room-date" className="block text-xs text-gray-500 mb-1">วันที่</label>
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
              <label htmlFor="room-start" className="block text-xs text-gray-500 mb-1">ตั้งแต่</label>
              <select
                id="room-start"
                value={startTime}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartTime(v);
                  if (v && (!endTime || endTime <= v)) setEndTime(addMinutes(v, 60));
                }}
                className="input-field"
              >
                <option value="">--:--</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="w-[calc(50%-0.5rem)] sm:w-36">
              <label htmlFor="room-end" className="block text-xs text-gray-500 mb-1">ถึง</label>
              <select
                id="room-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-field"
              >
                <option value="">--:--</option>
                {END_SLOTS.filter((t) => !startTime || t > startTime).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {(date || startTime) && !window_ && (
              <p className="text-xs text-amber-700 w-full">เลือกวันที่ เวลาเริ่ม และเวลาสิ้นสุด เพื่อกรองเฉพาะห้องที่ว่าง</p>
            )}
          </fieldset>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-600" aria-live="polite">
              {!isLoading && <>พบ <strong>{filteredRooms.length}</strong> ห้อง{window_ && " ที่ว่างในช่วงเวลาที่เลือก"}</>}
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="text-sm font-medium text-blue-700 hover:underline">
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-100 text-rose-700 rounded-lg" role="alert">
            ⚠️ {error}
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" />
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">ยังไม่มีห้องประชุมในระบบ</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">ไม่พบห้องที่ตรงกับเงื่อนไข</p>
            <button type="button" onClick={clearFilters} className="btn-secondary">
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <Link key={room.id} href={bookingHref(room.id)}>
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer h-full flex flex-col">
                  {room.image && (
                    <div className="relative w-full h-40 bg-gray-200 overflow-hidden">
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col">
                    <h2 className="text-lg font-bold text-blue-700 mb-1 line-clamp-2">
                      {room.name}
                    </h2>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {roomLocation(room.description)}
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5 text-sm text-gray-700">
                      <span>👥 <span className="font-semibold">{room.capacity}</span> ที่นั่ง</span>
                      <span>👤 {room.roomAdmin.name}</span>
                    </div>

                    <span className="btn-primary w-full mt-auto text-center">
                      {window_ ? "จองช่วงเวลานี้ →" : "ดูรายละเอียด & จอง →"}
                    </span>
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
