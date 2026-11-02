"use client";

import { useEffect, useRef, useState } from "react";
import { formatPricePerHour } from "@/lib/format";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/room-code";
import type { ImportIssue } from "@/lib/room-import";

interface PreviewRoom {
  line: number;
  code: string;
  roomType: RoomType;
  name: string;
  owner: string;
  building: string;
  floor: string;
  capacity: number;
  pricePerHour: number;
  roomAdminName: string;
  adminMatched: boolean;
}

interface Preview {
  rooms: PreviewRoom[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  existingRooms: number;
  existingBookings: number;
}

const SAMPLE_HEADER = "Building  Floor  Room_Type  Room_ID  Room  Owner  Current_Seat  Room_type_name  PerHour";

/** Excel "CSV UTF-8" decodes as UTF-8; plain "CSV" from Thai Windows is Windows-874. */
async function readSheetFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-874").decode(buffer);
  }
}

const lineLabel = (line: number) => (line ? `แถว ${line}: ` : "");

/** Replaces every room with rows copied from Excel or a .csv file, after a preview. */
export default function RoomImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (result: { created: number; deletedRooms: number; deletedBookings: number }) => void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setFileName("");
    setPreview(null);
    setConfirmed(false);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const post = async (commit: boolean) => {
    const response = await fetch("/api/admin/rooms/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, commit }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "นำเข้าไม่สำเร็จ");
    return data;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setPreview(null);
    setFileName(file.name);
    setText(await readSheetFile(file));
  };

  const handlePreview = async () => {
    setBusy(true);
    setError("");
    try {
      setPreview(await post(false));
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ตรวจสอบข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setError("");
    try {
      onImported(await post(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const canImport = !!preview && preview.errors.length === 0 && preview.rooms.length > 0 && confirmed && !busy;
  const unmatched = preview ? new Set(preview.rooms.filter((r) => !r.adminMatched).map((r) => r.owner)) : new Set<string>();

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-import-title"
        className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none flex items-center gap-2 px-6 py-4 border-b border-line">
          <h2 id="room-import-title" className="flex items-center gap-2 text-title-large text-ink">
            <span className="icon icon--24 text-primary" aria-hidden="true">upload_file</span>
            นำเข้าห้องจาก Excel
          </h2>
          <button type="button" onClick={onClose} className="icon-button ml-auto" aria-label="ปิด" disabled={busy}>
            <span className="icon icon--24" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="alert alert--error" role="alert">
              <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
              {error}
            </div>
          )}

          {!preview ? (
            <>
              <p className="text-body-medium text-ink-muted">
                เลือกช่วงข้อมูลใน Excel <strong className="text-ink">รวมแถวหัวตาราง</strong> แล้วคัดลอกมาวางในช่องด้านล่าง
                หรือเลือกไฟล์ที่บันทึกเป็น CSV คอลัมน์ที่ต้องมี:
              </p>
              <p className="font-mono text-body-small text-ink bg-surface-variant rounded-sm px-3 py-2 overflow-x-auto whitespace-pre">
                {SAMPLE_HEADER}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                  <span className="icon icon--20" aria-hidden="true">attach_file</span>
                  เลือกไฟล์ CSV
                </button>
                {fileName && <span className="text-body-small text-ink-muted">{fileName}</span>}
              </div>

              <div>
                <label htmlFor="room-import-text" className="field-label">หรือวางข้อมูลจาก Excel</label>
                <textarea
                  id="room-import-text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setFileName("");
                  }}
                  rows={12}
                  spellCheck={false}
                  className="input-field font-mono text-body-small !h-auto py-3 whitespace-pre"
                  placeholder={SAMPLE_HEADER}
                />
              </div>
            </>
          ) : (
            <>
              <div className={`alert ${preview.errors.length ? "alert--error" : "alert--warning"}`} role="status">
                <span className="icon icon--24" aria-hidden="true">{preview.errors.length ? "error" : "warning"}</span>
                <div>
                  <p>
                    พร้อมนำเข้า <strong>{preview.rooms.length}</strong> ห้อง
                    {preview.errors.length > 0 && <> · พบแถวที่ไม่ถูกต้อง <strong>{preview.errors.length}</strong> แถว ต้องแก้ไขก่อนนำเข้า</>}
                  </p>
                  <p>
                    การนำเข้าจะ<strong>ลบห้องเดิมทั้งหมด {preview.existingRooms} ห้อง</strong> และ
                    <strong>การจองทั้งหมด {preview.existingBookings} รายการ</strong> ย้อนกลับไม่ได้
                  </p>
                </div>
              </div>

              {preview.errors.length > 0 && (
                <section aria-labelledby="import-errors">
                  <h3 id="import-errors" className="text-title-small text-error mb-2">แถวที่ต้องแก้ไข</h3>
                  <ul className="text-body-small text-ink space-y-1 list-disc pl-5">
                    {preview.errors.map((e, i) => (
                      <li key={i}>{lineLabel(e.line)}{e.message}</li>
                    ))}
                  </ul>
                </section>
              )}

              {unmatched.size > 0 && (
                <p className="text-body-small text-ink-muted">
                  <span className="icon icon--20 align-middle mr-1" aria-hidden="true">person_alert</span>
                  ไม่พบผู้ดูแลห้องของ {[...unmatched].join(", ")} — ห้องเหล่านี้จะให้คุณเป็นผู้ดูแลไปก่อน แก้ไขภายหลังได้
                </p>
              )}

              {preview.warnings.length > 0 && (
                <details className="text-body-small text-ink-muted">
                  <summary className="cursor-pointer">คำเตือน {preview.warnings.length} รายการ (นำเข้าได้)</summary>
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{lineLabel(w.line)}{w.message}</li>
                    ))}
                  </ul>
                </details>
              )}

              {preview.rooms.length > 0 && (
                <div className="overflow-x-auto rounded-sm border border-line">
                  <table className="table w-full text-body-small">
                    <thead>
                      <tr>
                        <th className="text-left">แถว</th>
                        <th className="text-left">รหัสห้อง</th>
                        <th className="text-left">ชื่อห้อง</th>
                        <th className="text-left">ประเภท</th>
                        <th className="text-left">อาคาร/ชั้น</th>
                        <th className="text-right">ที่นั่ง</th>
                        <th className="text-right">ราคา</th>
                        <th className="text-left">หน่วยงาน / ผู้ดูแล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rooms.map((r) => (
                        <tr key={r.code}>
                          <td className="tabular-nums text-ink-subtle">{r.line}</td>
                          <td className="font-mono tabular-nums">{r.code}</td>
                          <td>{r.name}</td>
                          <td className="whitespace-nowrap">{ROOM_TYPE_LABELS[r.roomType]}</td>
                          <td className="whitespace-nowrap">อาคาร {r.building} ชั้น {r.floor}</td>
                          <td className="text-right tabular-nums">{r.capacity}</td>
                          <td className="text-right tabular-nums whitespace-nowrap">{formatPricePerHour(r.pricePerHour)}</td>
                          <td>
                            {r.owner}
                            <span className={`block ${r.adminMatched ? "text-ink-subtle" : "text-error"}`}>{r.roomAdminName}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.errors.length === 0 && preview.rooms.length > 0 && (
                <label className="checkbox">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  เข้าใจแล้วว่าห้องเดิม {preview.existingRooms} ห้องและการจอง {preview.existingBookings} รายการจะถูกลบถาวร
                </label>
              )}
            </>
          )}
        </div>

        <div className="flex-none flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-line">
          {!preview ? (
            <>
              <button type="button" onClick={onClose} className="btn-text" disabled={busy}>ยกเลิก</button>
              <button type="button" onClick={handlePreview} className="btn-primary" disabled={busy || !text.trim()}>
                <span className="icon icon--20" aria-hidden="true">fact_check</span>
                {busy ? "กำลังตรวจสอบ..." : "ตรวจสอบข้อมูล"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setPreview(null)} className="btn-text" disabled={busy}>
                แก้ไขข้อมูล
              </button>
              <button type="button" onClick={handleImport} className="btn-danger" disabled={!canImport}>
                <span className="icon icon--20" aria-hidden="true">upload</span>
                {busy ? "กำลังนำเข้า..." : `ลบห้องเดิมและนำเข้า ${preview.rooms.length} ห้อง`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
