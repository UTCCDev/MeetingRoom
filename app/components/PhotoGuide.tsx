"use client";

import { useRef, useState } from "react";
import {
  AMENITIES,
  COVER_MOCKUP,
  PHOTO_SHOTS,
  PHOTO_URL_ERROR,
  SHOT_INFO,
  SHOT_MOCKUPS,
  customShots,
  isPhotoUrl,
  type PhotoShot,
  type RoomPhoto,
  type RoomPhotos,
} from "@/lib/room-photos";

export const GENERAL_TIPS = [
  "เปิดไฟทุกดวงและเปิดม่าน",
  "จัดเก้าอี้ให้เรียบร้อย เก็บของบนโต๊ะ",
  "ถ่ายแนวนอน (16:9) ไม่มีคนในภาพ",
];

const MAX_BYTES = 5 * 1024 * 1024;

/** The whole-room shot, stored as Room.image. */
export const COVER_SHOT = {
  title: "ภาพรวมห้อง (รูปหลัก)",
  tip: "ยืนที่มุมห้องหรือหน้าประตู ถ่ายแนวนอนให้เห็นโต๊ะทั้งตัวและผนังสองด้าน ใช้เป็นรูปบนการ์ดห้อง",
};

async function uploadPhoto(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("ไฟล์ใหญ่เกิน 5 MB");
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "อัปโหลดรูปไม่สำเร็จ");
  return data.url;
}

/** One shot: sample or the room's photo, how to take it, upload / remove / paste a URL. */
function ShotCard({
  id,
  value,
  onChange,
  sample,
  title,
  tip,
  folder,
  onRemove,
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
  /** Mock-up shown while empty; custom amenities have none and show a placeholder. */
  sample?: RoomPhoto;
  title: string;
  tip: string;
  /** The room's photo-folder file for this shot, shown when nothing is uploaded. */
  folder?: string;
  /** Amenity slots: removes the amenity from the room, and with it this photo. */
  onRemove?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const url = value.trim();
  const invalid = !isPhotoUrl(url);
  // The folder photo wins, same as on the room pages (see roomImage).
  const own = folder || (invalid ? "" : url);

  const onFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      onChange(await uploadPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <figure className="rounded-sm overflow-hidden ring-1 ring-line bg-canvas flex flex-col">
      <div className="relative aspect-video overflow-hidden bg-surface-variant">
        {own || sample ? (
          <img src={own || sample?.src} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-ink-subtle">
            <span className="icon icon--24" aria-hidden="true">add_photo_alternate</span>
          </span>
        )}
        <span className={`absolute top-2 left-2 shadow-sm ${own ? "badge--success" : "badge-neutral !bg-white/90"}`}>
          {own ? (folder ? "รูปจากโฟลเดอร์" : "รูปจริง") : !sample ? "ยังไม่มีรูป" : sample.source ? "ภาพตัวอย่าง" : "ภาพจำลอง"}
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-white text-title-small">
            กำลังอัปโหลด…
          </span>
        )}
      </div>
      <figcaption className="p-2 flex flex-col gap-2 flex-1">
        <p className="text-title-small text-ink">{title}</p>
        <p className="text-body-small text-ink-muted flex-1">{tip}</p>
        {!own && sample?.source && (
          // CC BY / BY-SA samples must keep their credit.
          <a
            href={sample.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-large text-ink-subtle hover:text-primary hover:underline"
          >
            ภาพตัวอย่าง: {sample.creator || "ไม่ระบุ"} · {sample.license}
          </a>
        )}
        {!own && sample && !sample.source && <p className="text-label-large text-ink-subtle">ภาพจำลองการถ่ายรูป</p>}

        <input
          ref={fileRef}
          id={`${id}-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-tonal btn--s flex-1"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={`${own ? "เปลี่ยน" : "อัปโหลด"}รูป${title}`}
          >
            <span className="icon icon--20" aria-hidden="true">upload</span>
            {own ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          </button>
          {onRemove ? (
            <button
              type="button"
              className="icon-button"
              onClick={onRemove}
              disabled={uploading}
              aria-label={`ลบ${title}ออกจากห้อง`}
              title="ลบรายการนี้ออกจากห้อง"
            >
              <span className="icon icon--20" aria-hidden="true">delete</span>
            </button>
          ) : url && (
            <button
              type="button"
              className="icon-button"
              onClick={() => onChange("")}
              disabled={uploading}
              aria-label={`ลบรูป${title}`}
            >
              <span className="icon icon--20" aria-hidden="true">delete</span>
            </button>
          )}
        </div>

        <details className="text-body-small text-ink-subtle" open={invalid}>
          <summary className="cursor-pointer hover:text-primary">หรือวาง URL รูป</summary>
          <label htmlFor={id} className="sr-only">URL รูป{title}</label>
          <input
            id={id}
            type="text"
            inputMode="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-field !h-10 !px-3 !text-body-medium mt-2"
            placeholder="https://…"
            aria-invalid={invalid}
          />
        </details>
        {(error || invalid) && (
          <p className="field-error" role="alert">{error || PHOTO_URL_ERROR}</p>
        )}
      </figcaption>
    </figure>
  );
}

const isAmenity = (shot: PhotoShot) => (AMENITIES as readonly string[]).includes(shot);

/**
 * The room form's photo slots, matching the gallery: the main photo, seating and entrance
 * for every room, plus one per ticked amenity. Each has a sample, how to take it, and an
 * upload button. Inline rather than a separate page so it doesn't lose the unsaved form.
 */
export default function PhotoGuide({
  amenities,
  cover = "",
  onCoverChange,
  photos,
  onPhotoChange,
  folder = {},
  onRemoveAmenity,
}: {
  /** Ticked amenities; their photo slots show. */
  amenities: string[];
  cover?: string;
  onCoverChange: (url: string) => void;
  photos: RoomPhotos;
  // Per shot, so the parent can update from fresh state: uploads finish out of order.
  // shot is a PhotoShot or a custom amenity's name.
  onPhotoChange: (shot: string, url: string) => void;
  /** The room's photo-folder files (see folderPhotos), shown behind empty slots. */
  folder?: RoomPhotos & { cover?: string };
  /** Unticks an amenity (built-in or custom); its photo is dropped on save. */
  onRemoveAmenity: (amenity: string) => void;
}) {
  const [open, setOpen] = useState(true);
  // Amenity slots show only while the room lists the amenity, same as the gallery.
  const shown = (shot: PhotoShot) => !isAmenity(shot) || amenities.includes(shot);
  const roomShots = PHOTO_SHOTS.filter((s) => !isAmenity(s));
  const equipmentShots = PHOTO_SHOTS.filter((s) => isAmenity(s) && shown(s));
  const customs = customShots(amenities);
  const slots = [
    folder.cover || cover,
    ...[...roomShots, ...equipmentShots, ...customs].map((s) => folder[s] || photos[s] || ""),
  ];
  const filled = slots.filter((u) => u.trim() && isPhotoUrl(u)).length;

  const card = (shot: PhotoShot) => (
    <ShotCard
      key={shot}
      id={`room-photo-${shot}`}
      value={photos[shot] || ""}
      onChange={(url) => onPhotoChange(shot, url)}
      sample={SHOT_MOCKUPS[shot]}
      title={SHOT_INFO[shot].title}
      tip={SHOT_INFO[shot].tip}
      folder={folder[shot]}
      onRemove={isAmenity(shot) ? () => onRemoveAmenity(shot) : undefined}
    />
  );

  // Ids by position: the names are free text (Thai, spaces).
  const customCard = (name: string, i: number) => (
    <ShotCard
      key={name}
      id={`room-photo-custom-${i}`}
      value={photos[name] || ""}
      onChange={(url) => onPhotoChange(name, url)}
      title={name}
      tip={`ถ่าย${name}ให้เห็นชัด ๆ และเห็นตำแหน่งที่ตั้งในห้อง`}
      folder={folder[name]}
      onRemove={() => onRemoveAmenity(name)}
    />
  );

  return (
    <div className="rounded-md border border-line bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="photo-guide"
        className="w-full flex items-center gap-3 px-4 h-12 text-title-small text-primary hover:bg-canvas"
      >
        <span className="icon icon--20" aria-hidden="true">photo_camera</span>
        รูปห้องและอุปกรณ์ภายในห้อง
        <span className="text-body-small text-ink-subtle">ใส่แล้ว {filled}/{slots.length}</span>
        <span className="icon icon--20 ml-auto" aria-hidden="true">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div id="photo-guide" className="px-4 pb-4 space-y-3">
          <p className="text-body-small text-ink-muted">
            ถ่ายตามภาพจำลองของแต่ละช่อง แล้วกด &quot;อัปโหลดรูป&quot; (JPG, PNG หรือ WebP ไม่เกิน 5 MB)
            ช่องที่ไม่ได้ใส่จะแสดงภาพจำลองแทน
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-small text-ink-muted">
            {GENERAL_TIPS.map((t) => (
              <li key={t} className="flex items-center gap-1">
                <span className="icon icon--20 icon--success" aria-hidden="true">check</span>
                {t}
              </li>
            ))}
          </ul>

          <h3 className="text-title-medium text-ink pt-1">ตัวห้อง</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <ShotCard
              id="room-photo-cover"
              value={cover}
              onChange={onCoverChange}
              sample={COVER_MOCKUP}
              title={COVER_SHOT.title}
              tip={COVER_SHOT.tip}
              folder={folder.cover}
            />
            {roomShots.map(card)}
          </div>

          <h3 className="text-title-medium text-ink pt-2">อุปกรณ์ภายในห้อง</h3>
          {equipmentShots.length + customs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {equipmentShots.map(card)}
              {customs.map(customCard)}
            </div>
          ) : (
            <p className="flex items-center gap-2 p-3 rounded-sm bg-canvas text-body-small text-ink-muted">
              <span className="icon icon--20" aria-hidden="true">info</span>
              เลือก &quot;สิ่งอำนวยความสะดวก&quot; ที่ห้องมี แล้วช่องรูปของอุปกรณ์แต่ละชิ้นจะขึ้นที่นี่
            </p>
          )}
        </div>
      )}
    </div>
  );
}
