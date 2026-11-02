/**
 * Scans public/room-photos/all/<CODE>/ and writes lib/room-photo-files.json, which maps each room
 * code to its photos by shot. Files must be named <CODE>_<shot>.<ext>, e.g. E030401_entrance.jpg;
 * a second photo of the same shot is <CODE>_<shot>-2.jpg (the first one is used).
 * Any other name is a custom amenity's photo, named exactly as the amenity, e.g. E071201_ลำโพง.jpg.
 * Runs before dev/build; run it by hand with `npm run photos`.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Keep in sync with PHOTO_SHOTS in lib/room-photos.ts; "cover" is the whole-room shot (Room.image).
const SHOTS = ["cover", "seating", "projector", "whiteboard", "videoconference", "printer", "tv", "microphone", "entrance"];
const ROOT = "public/room-photos/all";
const OUT = "lib/room-photo-files.json";

const manifest = {};
const skipped = [];
for (const code of readdirSync(ROOT).sort()) {
  const dir = join(ROOT, code);
  if (!statSync(dir).isDirectory()) continue;
  const shots = {};
  const rank = {}; // lowest -N wins; no suffix counts as 1
  for (const file of readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
    const m = file.normalize("NFC").match(/^([^_]+)_(.+?)(?:-(\d+))?\.\w+$/);
    // "other" is a placeholder for a photo that still needs a proper name.
    if (!m || m[1] !== code || m[2].toLowerCase() === "other") {
      skipped.push(`${code}/${file}`);
      continue;
    }
    const shot = SHOTS.includes(m[2].toLowerCase()) ? m[2].toLowerCase() : m[2].trim();
    const n = Number(m[3] ?? 1);
    if (rank[shot] !== undefined && rank[shot] <= n) continue;
    rank[shot] = n;
    shots[shot] = `/room-photos/all/${encodeURIComponent(code)}/${encodeURIComponent(file)}`;
  }
  if (Object.keys(shots).length) manifest[code] = shots;
}

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");
console.log(`room photos: ${Object.keys(manifest).length} rooms -> ${OUT}`);
if (skipped.length) {
  console.log(`room photos: ${skipped.length} file(s) not named <CODE>_<shot or amenity name>.jpg, skipped`);
  for (const f of skipped.slice(0, 10)) console.log(`  ${f}`);
  if (skipped.length > 10) console.log(`  ...`);
}
