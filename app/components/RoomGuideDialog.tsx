"use client";

import { useEffect, useRef } from "react";
import { AMENITIES, COVER_MOCKUP, PHOTO_SHOTS, SHOT_INFO, SHOT_MOCKUPS, type RoomPhoto } from "@/lib/room-photos";
import { COVER_SHOT, GENERAL_TIPS } from "./PhotoGuide";

const ADD_STEPS = [
  { title: "กด \"เพิ่มห้องใหม่\"", text: "ปุ่มอยู่มุมขวาบนของหน้านี้" },
  { title: "กรอกข้อมูลห้อง", text: "ชื่อห้องและจำนวนที่นั่งต้องกรอก ส่วนหน่วยงาน อาคาร และชั้นช่วยให้ผู้จองหาห้องเจอ" },
  { title: "เลือกผู้ดูแลห้อง", text: "ผู้ดูแลห้องจะเป็นผู้อนุมัติการจองห้องนี้ และแก้ไขข้อมูลห้องได้" },
  { title: "เลือกสิ่งอำนวยความสะดวก", text: "ติ๊กอุปกรณ์ที่ห้องมีจริง ระบบจะเพิ่มช่องรูปของอุปกรณ์แต่ละชิ้นให้" },
  { title: "อัปโหลดรูปตามช่อง", text: "ถ่ายตามภาพจำลองของแต่ละช่อง ช่องที่ไม่ได้ใส่จะแสดงภาพจำลองแทน" },
  { title: "กด \"สร้างห้อง\"", text: "ห้องที่ติ๊ก \"เปิดให้จอง\" จะแสดงในหน้าค้นหาทันที" },
];

const MANAGE_ITEMS = [
  { icon: "edit", title: "⋮ › แก้ไข", text: "เปลี่ยนข้อมูล ผู้ดูแล อุปกรณ์ หรือรูปของห้อง" },
  { icon: "toggle_on", title: "สวิตช์ \"เปิดให้จอง\"", text: "ปิดเพื่อซ่อนห้องจากหน้าค้นหาชั่วคราว มีผลทันที การจองเดิมยังอยู่" },
  { icon: "delete", title: "⋮ › ลบ", text: "ลบห้องถาวร ถ้าห้องยังมีการจองค้างอยู่ ระบบจะปิดใช้งานแทนการลบ" },
];

function Section({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="flex items-center gap-2 text-title-medium text-ink">
        <span className="icon icon--24 text-primary" aria-hidden="true">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Example({ photo, title, tip, when }: { photo: RoomPhoto; title: string; tip: string; when: string }) {
  return (
    <figure className="rounded-sm overflow-hidden ring-1 ring-line bg-canvas flex flex-col">
      <div className="aspect-video overflow-hidden bg-surface-variant">
        <img src={photo.src} alt={photo.source ? `ตัวอย่างภาพ${title}` : `ภาพจำลอง${title}`} loading="lazy" className="w-full h-full object-cover" />
      </div>
      <figcaption className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-label-large text-ink">{title}</p>
        <p className="text-label-medium text-primary">{when}</p>
        <p className="text-body-small text-ink-muted flex-1">{tip}</p>
        {/* CC BY / BY-SA samples must keep their credit; a generated mock-up says so instead. */}
        {photo.source ? (
          <a
            href={photo.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-medium text-ink-subtle hover:text-primary hover:underline"
          >
            ภาพ: {photo.creator || "ไม่ระบุ"} · {photo.license}
          </a>
        ) : (
          <p className="text-label-medium text-ink-subtle">ภาพจำลองการถ่ายรูป</p>
        )}
      </figcaption>
    </figure>
  );
}

const isAmenity = (shot: string) => (AMENITIES as readonly string[]).includes(shot);
// Shots every room has first, then one per amenity.
const GUIDE_SHOTS = [...PHOTO_SHOTS.filter((s) => !isAmenity(s)), ...PHOTO_SHOTS.filter(isAmenity)];

/** "คู่มือ" for the room management page: how to add and manage rooms, and how to photograph them. */
export default function RoomGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Latest onClose without re-running the effect, which would steal focus on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-guide-title"
        className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none flex items-center gap-2 px-6 py-4 border-b border-line">
          <h2 id="room-guide-title" className="flex items-center gap-2 text-title-large text-ink">
            <span className="icon icon--24 text-primary" aria-hidden="true">menu_book</span>
            คู่มือจัดการห้อง
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="icon-button ml-auto" aria-label="ปิดคู่มือ">
            <span className="icon icon--24" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-8">
          <Section id="guide-add" icon="add_business" title="เพิ่มห้องใหม่">
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ADD_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3 p-3 rounded-sm border border-line">
                  <span
                    className="flex-none inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary-container text-label-large"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-label-large text-ink">{step.title}</p>
                    <p className="text-body-small text-ink-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="guide-manage" icon="tune" title="จัดการห้องที่มีอยู่">
            <p className="text-body-small text-ink-muted">บนการ์ดห้องแต่ละใบ</p>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MANAGE_ITEMS.map((item) => (
                <li key={item.title} className="flex gap-3 p-3 rounded-sm border border-line">
                  <span className="icon icon--24 text-ink-subtle" aria-hidden="true">{item.icon}</span>
                  <div>
                    <p className="text-label-large text-ink">{item.title}</p>
                    <p className="text-body-small text-ink-muted">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="guide-photos" icon="photo_camera" title="การถ่ายรูปห้องและอุปกรณ์">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-body-small text-ink-muted">
              {[...GENERAL_TIPS, "ไฟล์ JPG, PNG หรือ WebP ไม่เกิน 5 MB"].map((t) => (
                <li key={t} className="flex items-center gap-1">
                  <span className="icon icon--20 icon--success" aria-hidden="true">check</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Example photo={COVER_MOCKUP} title={COVER_SHOT.title} tip={COVER_SHOT.tip} when="ทุกห้อง" />
              {GUIDE_SHOTS.map((shot) => (
                <Example
                  key={shot}
                  photo={SHOT_MOCKUPS[shot]}
                  title={SHOT_INFO[shot].title}
                  tip={SHOT_INFO[shot].tip}
                  when={isAmenity(shot) ? "เมื่อห้องมีอุปกรณ์นี้" : "ทุกห้อง"}
                />
              ))}
            </div>
          </Section>
        </div>

        <div className="flex-none flex justify-end px-6 py-4 border-t border-line">
          <button type="button" onClick={onClose} className="btn-primary">เข้าใจแล้ว</button>
        </div>
      </div>
    </div>
  );
}
