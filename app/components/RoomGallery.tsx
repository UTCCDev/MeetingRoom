"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AMENITIES,
  CARD_MOCKUPS,
  PHOTO_SHOTS,
  ROOM_PHOTOS,
  SHOT_INFO,
  SHOT_MOCKUPS,
  layoutTopic,
  pick,
  roomCover,
  type PhotoTopic,
  type RoomPhoto,
  type RoomPhotos,
} from "@/lib/room-photos";

// Re-exported so existing imports from this file keep working; the implementation
// lives in lib/room-photos.ts since it's also needed from server components (e.g. the landing page).
export { layoutTopic, roomCover };

interface GalleryRoom {
  id: string;
  name: string;
  capacity: number;
  amenities: string[];
  image?: string | null;
  photos?: RoomPhotos;
}

interface Slide {
  src: string;
  title: string; // topic shown to the user, e.g. "มุมนำเสนอ"
  sample: boolean; // true = mock-up of a similar room, not this room
  credit?: RoomPhoto;
}

// Stable per-room pick so neighbouring rooms don't all show the same photos.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}


/**
 * One slide per topic: the room's own photo where it has one, else a mock-up (the whole-room
 * one matches the room card). Equipment topics show when the room lists that amenity or has a
 * real photo of it.
 */
function slidesFor(room: GalleryRoom): Slide[] {
  const seed = hash(room.id);
  const photos = room.photos || {};
  const has = (a: string) => room.amenities.includes(a);
  const layout = layoutTopic(room.capacity);
  const topics: { mockup: RoomPhoto; title: string; own?: string | null }[] = [
    { mockup: pick(layout.topic, seed, CARD_MOCKUPS), title: layout.label, own: room.image },
  ];
  for (const shot of PHOTO_SHOTS) {
    const isAmenity = (AMENITIES as readonly string[]).includes(shot);
    if (!isAmenity || has(shot) || photos[shot]) {
      topics.push({ mockup: SHOT_MOCKUPS[shot], title: SHOT_INFO[shot].title, own: photos[shot] });
    }
  }

  return topics.map(({ mockup, title, own }) => {
    if (own) return { src: own, title, sample: false };
    // Mock-ups have no source; only credited stock photos get a credit line.
    return { src: mockup.src, title, sample: true, credit: mockup.source ? mockup : undefined };
  });
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
      <span className="icon icon--20" aria-hidden="true">open_in_new</span>
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
    // Opaque (primary-tinted near-black) so nothing behind, such as the sidebar, shows through.
    <div
      className="lightbox fixed inset-0 z-[60] flex flex-col bg-[#0B0C24] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`ภาพห้อง ${room.name}`}
    >
      <div className="flex items-center gap-4 px-4 sm:px-8 py-4 flex-none border-b border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-title-medium truncate">{room.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-body-small text-white/70" aria-live="polite">
            <span className="text-white">{current.title}</span>
            {current.sample && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-highlight text-on-highlight text-label-small">
                <span className="icon icon--20 !text-[16px]" aria-hidden="true">photo_camera</span>
                ภาพจำลอง
              </span>
            )}
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center h-9 px-3 rounded-full bg-white/10 text-label-medium tabular-nums">
          {index + 1} / {count}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="lightbox__btn w-11 h-11"
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
              className="flex-none w-full h-full flex items-center justify-center px-4 sm:px-24 py-6"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} จาก ${count}: ${s.title}`}
              aria-hidden={i !== index}
            >
              <img
                src={s.src}
                alt={`${s.sample ? "ภาพจำลอง" : "ภาพ"}${s.title} ${room.name}`}
                draggable={false}
                loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                className="max-w-full max-h-full w-auto h-auto rounded-lg shadow-[0_24px_64px_rgba(0,0,0,0.5)] object-contain"
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="lightbox__btn hidden sm:inline-flex absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12"
              aria-label="ภาพก่อนหน้า"
            >
              <span className="icon icon--24" aria-hidden="true">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="lightbox__btn hidden sm:inline-flex absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12"
              aria-label="ภาพถัดไป"
            >
              <span className="icon icon--24" aria-hidden="true">chevron_right</span>
            </button>
          </>
        )}
      </div>

      <div className="flex-none flex flex-col items-center gap-2 px-4 pt-3 pb-4 border-t border-white/10">
        <div className="flex [justify-content:safe_center] gap-3 w-full overflow-x-auto p-1 [scrollbar-width:none]">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`ดูภาพ ${s.title}`}
              aria-current={i === index}
              className={`group flex-none w-24 sm:w-32 flex flex-col gap-1 text-left transition-opacity ${
                i === index ? "" : "opacity-55 hover:opacity-100"
              }`}
            >
              <span
                className={`block aspect-video rounded-sm overflow-hidden ${
                  i === index ? "ring-2 ring-highlight ring-offset-2 ring-offset-[#0B0C24]" : "ring-1 ring-white/15"
                }`}
              >
                <img src={s.src} alt="" loading="lazy" className="w-full h-full object-cover" />
              </span>
              <span className={`text-label-small truncate ${i === index ? "text-highlight" : "text-white/80"}`}>{s.title}</span>
            </button>
          ))}
        </div>
        <p className="min-h-[1.4rem] text-body-small text-white/60 text-center">
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
        className="group relative block w-full aspect-video overflow-hidden card__media"
        aria-label={`ดูภาพห้องทั้งหมด ${slides.length} ภาพ`}
      >
        <img
          src={slides[0].src}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
        {slides[0].sample && (
          <span className="absolute top-3 left-3 badge-neutral !bg-white/90 shadow-sm">
            <span className="icon icon--20" aria-hidden="true">photo_camera</span>
            ภาพจำลอง
          </span>
        )}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink/75 text-white text-label-medium">
          <span className="icon icon--20" aria-hidden="true">photo_library</span>
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
              className="group relative aspect-video rounded-sm overflow-hidden ring-1 ring-line hover:ring-2 hover:ring-primary"
              aria-label={`ดูภาพ ${s.title}`}
            >
              <img src={s.src} alt="" loading="lazy" className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 px-2 py-1 bg-ink/70 text-white text-label-medium truncate">
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
