"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROOM_PHOTOS, type PhotoTopic, type RoomPhoto } from "@/lib/room-photos";

interface GalleryRoom {
  id: string;
  name: string;
  capacity: number;
  amenities: string[];
  image?: string | null;
}

interface Slide {
  src: string;
  title: string; // topic shown to the user, e.g. "มุมนำเสนอ"
  sample: boolean; // true = stock photo of a similar room, not this room
  credit?: RoomPhoto;
}

/** Room size → which "whole room" photos fit. */
export function layoutTopic(capacity: number): { topic: PhotoTopic; label: string } {
  if (capacity <= 8) return { topic: "round", label: "ห้องประชุมย่อย" };
  if (capacity <= 20) return { topic: "board", label: "ห้องประชุมโต๊ะยาว" };
  if (capacity <= 40) return { topic: "ushape", label: "ห้องประชุมรูปตัวยู" };
  return { topic: "theater", label: "ห้องสัมมนา" };
}

// Stable per-room pick so neighbouring rooms don't all show the same photos.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(topic: PhotoTopic, seed: number): RoomPhoto {
  const pool = ROOM_PHOTOS[topic];
  return pool[seed % pool.length];
}

/** The room's cover photo: its own image, else a sample matching its size. */
export function roomCover(room: { id: string; capacity: number; image?: string | null }): string {
  return room.image || pick(layoutTopic(room.capacity).topic, hash(room.id)).src;
}

/** Up to six slides, each a different topic; the room's own photo leads when it has one. */
function slidesFor(room: GalleryRoom): Slide[] {
  const seed = hash(room.id);
  const has = (a: string) => room.amenities.includes(a);
  const topics: { topic: PhotoTopic; title: string }[] = [
    { topic: layoutTopic(room.capacity).topic, title: layoutTopic(room.capacity).label },
    { topic: "seating", title: "ที่นั่ง" },
  ];
  if (has("projector") || has("tv")) topics.push({ topic: "presentation", title: "จอนำเสนอ" });
  if (has("whiteboard")) topics.push({ topic: "whiteboard", title: "กระดานไวท์บอร์ด" });
  if (has("videoconference")) topics.push({ topic: "video", title: "ระบบประชุมออนไลน์" });
  topics.push({ topic: "entrance", title: "หน้าห้อง" });

  const samples: Slide[] = topics.map(({ topic, title }, i) => {
    const photo = pick(topic, seed + i);
    return { src: photo.src, title, sample: true, credit: photo };
  });
  const own: Slide[] = room.image ? [{ src: room.image, title: "ภาพห้องจริง", sample: false }] : [];
  return [...own, ...samples].slice(0, 6);
}

function Credit({ photo }: { photo: RoomPhoto }) {
  return (
    <a
      href={photo.source}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 hover:text-white hover:underline"
    >
      ภาพ: {photo.creator || photo.title} · {photo.license}
      <span className="icon icon--20 icon--w300" aria-hidden="true">open_in_new</span>
    </a>
  );
}

function Lightbox({
  room,
  slides,
  index,
  onIndex,
  onClose,
}: {
  room: GalleryRoom;
  slides: Slide[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const count = slides.length;
  const go = useCallback((i: number) => onIndex((i + count) % count), [onIndex, count]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  // Swipe: drag the track, snap to the next/previous slide past 60px.
  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current !== null) setDragX(e.clientX - dragStart.current);
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    if (dragX < -60) go(index + 1);
    else if (dragX > 60) go(index - 1);
    dragStart.current = null;
    setDragX(0);
  };

  const current = slides[index];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`ภาพห้อง ${room.name}`}
    >
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16 flex-none">
        <div className="min-w-0 flex-1">
          <p className="text-title-small truncate">{room.name}</p>
          <p className="text-label-medium font-normal text-white/70" aria-live="polite">
            {current.title} · {index + 1} / {count}
            {current.sample && " · ภาพตัวอย่าง"}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-white/10"
          aria-label="ปิด"
        >
          <span className="icon icon--24" aria-hidden="true">close</span>
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden" aria-roledescription="carousel">
        <div
          className={`flex h-full touch-pan-y select-none ${
            dragStart.current === null ? "transition-transform duration-300 ease-out motion-reduce:transition-none" : ""
          }`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${dragX}px))` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {slides.map((s, i) => (
            <div
              key={i}
              className="flex-none w-full h-full flex items-center justify-center px-4 sm:px-20 py-2"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} จาก ${count}: ${s.title}`}
              aria-hidden={i !== index}
            >
              <img
                src={s.src}
                alt={`${s.sample ? "ภาพตัวอย่าง" : "ภาพ"}${s.title} ${room.name}`}
                draggable={false}
                loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                className="max-w-full max-h-full w-auto h-auto rounded-m shadow-2xl object-contain"
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="hidden sm:inline-flex absolute left-4 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-white text-ink shadow-lg hover:bg-primary-container"
              aria-label="ภาพก่อนหน้า"
            >
              <span className="icon icon--24 icon--w500" aria-hidden="true">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-white text-ink shadow-lg hover:bg-primary-container"
              aria-label="ภาพถัดไป"
            >
              <span className="icon icon--24 icon--w500" aria-hidden="true">chevron_right</span>
            </button>
          </>
        )}
      </div>

      <div className="flex-none flex flex-col items-center gap-3 px-4 py-4">
        <div className="flex justify-center gap-2 max-w-full overflow-x-auto">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`ดูภาพ ${s.title}`}
              aria-current={i === index}
              className={`flex-none w-20 sm:w-28 aspect-video rounded-s overflow-hidden transition ${
                i === index ? "ring-2 ring-white ring-offset-2 ring-offset-ink" : "opacity-50 hover:opacity-100"
              }`}
            >
              <img src={s.src} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        <p className="min-h-[1.4rem] text-label-small font-normal text-white/60 text-center">
          {current.credit && <Credit photo={current.credit} />}
        </p>
      </div>
    </div>
  );
}

/** Main photo + thumbnail strip; any photo opens the lightbox at that slide. */
export default function RoomGallery({ room }: { room: GalleryRoom }) {
  const slides = slidesFor(room);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(0)}
        className="group relative block w-full aspect-video overflow-hidden bg-primary-container"
        aria-label={`ดูภาพห้องทั้งหมด ${slides.length} ภาพ`}
      >
        <img
          src={slides[0].src}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
        {slides[0].sample && (
          <span className="absolute top-3 left-3 badge-neutral bg-white/90 shadow-sm">
            <span className="icon icon--20 icon--w500" aria-hidden="true">photo_camera</span>
            ภาพตัวอย่าง
          </span>
        )}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink/75 text-white text-label-medium">
          <span className="icon icon--20 icon--w500" aria-hidden="true">photo_library</span>
          ดูภาพทั้งหมด ({slides.length})
        </span>
      </button>

      {slides.length > 1 && (
        <div className="grid grid-cols-5 gap-2 p-2 bg-white">
          {slides.slice(1).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i + 1)}
              className="group relative aspect-video rounded-xs overflow-hidden ring-1 ring-line hover:ring-2 hover:ring-primary"
              aria-label={`ดูภาพ ${s.title}`}
            >
              <img src={s.src} alt="" loading="lazy" className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 bg-ink/60 text-white text-label-small font-normal truncate">
                {s.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {open !== null && (
        <Lightbox room={room} slides={slides} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
