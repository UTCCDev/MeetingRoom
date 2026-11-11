import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { SERVICE_UPLOAD_DIR, UPLOAD_MAX_BYTES, fileType } from "@/lib/uploads";

export const SERVICE_MAX_FILES = 5;

export class UploadError extends Error {}

export type SavedServiceFile = { fileName: string; originalName: string; mime: string; size: number };

/** Validate (count, size, magic bytes) then store files under uploads/service as uuid.ext. */
export async function saveServiceFiles(files: File[]): Promise<SavedServiceFile[]> {
  if (files.length > SERVICE_MAX_FILES) throw new UploadError("แนบไฟล์ได้ไม่เกิน 5 ไฟล์");
  const checked: { bytes: Uint8Array; type: NonNullable<ReturnType<typeof fileType>>; file: File }[] = [];
  for (const file of files) {
    if (file.size > UPLOAD_MAX_BYTES) throw new UploadError("ไฟล์ใหญ่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = fileType(bytes);
    if (!type) throw new UploadError("รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WebP");
    checked.push({ bytes, type, file });
  }
  if (checked.length) await mkdir(SERVICE_UPLOAD_DIR, { recursive: true });
  const saved: SavedServiceFile[] = [];
  for (const { bytes, type, file } of checked) {
    const fileName = `${randomUUID()}.${type.ext}`;
    await writeFile(path.join(SERVICE_UPLOAD_DIR, fileName), bytes);
    saved.push({ fileName, originalName: file.name, mime: type.mime, size: file.size });
  }
  return saved;
}
