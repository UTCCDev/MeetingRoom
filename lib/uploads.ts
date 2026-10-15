import path from "path";

/** Uploaded room photos live outside public/ and are served by /api/uploads/[name]. */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads", "rooms");
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Detect JPG / PNG / WebP from the file's first bytes. */
export function imageType(b: Uint8Array): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  return null;
}
