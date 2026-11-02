// Parses the room sheet exported from Excel (pasted cells = tab-separated, or a
// .csv file) into rooms ready to insert. Shared by the import dialog and API so
// both report the same errors.
import { ROOM_CODE_PATTERN, ROOM_TYPES, ROOM_TYPE_PREFIX, buildRoomCode, type RoomType } from "./room-code";

// Header names as they appear in the sheet (matched case-insensitively, spaces ignored).
const COLUMNS = {
  building: "building",
  floor: "floor",
  roomType: "room_type",
  code: "room_id",
  name: "room",
  owner: "owner",
  capacity: "current_seat",
  pricePerHour: "perhour",
} as const;
type Column = keyof typeof COLUMNS;

const PREFIX_TO_TYPE = Object.fromEntries(ROOM_TYPES.map((t) => [ROOM_TYPE_PREFIX[t], t])) as Record<string, RoomType>;

export const MAX_IMPORT_ROWS = 2000;

export interface ImportRoom {
  line: number;
  code: string;
  roomType: RoomType;
  roomNumber: string;
  name: string;
  owner: string;
  building: string;
  floor: string;
  capacity: number;
  pricePerHour: number;
}

export interface ImportIssue {
  line: number;
  message: string;
}

export interface ImportParseResult {
  rooms: ImportRoom[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

/** Splits text into rows of cells. Tab-separated when the header has tabs, else CSV with quotes. */
function splitRows(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const sep = firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const normalizeHeader = (h: string) => h.replace(/\s+/g, "").toLowerCase();
/** "1,300" / " 200 " → number; NaN when not numeric. */
const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[,\s]/g, "")));

export function parseRoomSheet(text: string): ImportParseResult {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const rooms: ImportRoom[] = [];

  const rows = splitRows(text.replace(/^﻿/, ""));
  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim()));
  if (headerIndex === -1) return { rooms, errors: [{ line: 0, message: "ไม่พบข้อมูล" }], warnings };

  const header = rows[headerIndex].map(normalizeHeader);
  const index = {} as Record<Column, number>;
  const missing: string[] = [];
  for (const [key, name] of Object.entries(COLUMNS) as [Column, string][]) {
    index[key] = header.indexOf(name);
    if (index[key] === -1) missing.push(name);
  }
  if (missing.length) {
    return {
      rooms,
      errors: [{ line: headerIndex + 1, message: `ไม่พบคอลัมน์: ${missing.join(", ")} (ต้องคัดลอกแถวหัวตารางมาด้วย)` }],
      warnings,
    };
  }

  const seenCodes = new Map<string, number>();
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells.some((c) => c.trim())) continue;
    const line = r + 1;
    const get = (k: Column) => (cells[index[k]] ?? "").trim();
    const fail = (message: string) => errors.push({ line, message });

    if (rooms.length + errors.length >= MAX_IMPORT_ROWS) {
      fail(`นำเข้าได้ไม่เกิน ${MAX_IMPORT_ROWS} ห้องต่อครั้ง`);
      break;
    }

    const code = get("code").toUpperCase();
    const prefix = get("roomType").toUpperCase();
    const building = get("building");
    const floor = get("floor").toUpperCase();
    const name = get("name").replace(/\s+/g, " ");
    const owner = get("owner").replace(/\s+/g, " ");
    const capacity = toNumber(get("capacity"));
    const price = toNumber(get("pricePerHour"));
    const roomType = PREFIX_TO_TYPE[prefix];

    const before = errors.length;
    if (!roomType) fail(`Room_Type "${prefix}" ต้องเป็น M, E หรือ S`);
    if (!ROOM_CODE_PATTERN.test(code)) fail(`Room_ID "${code}" ไม่ถูกรูปแบบ (เช่น M030401)`);
    else if (roomType) {
      const roomNumber = code.slice(-2);
      const expected = buildRoomCode(roomType, building, floor, roomNumber);
      if (expected !== code) fail(`Room_ID "${code}" ไม่ตรงกับประเภท/อาคาร/ชั้น (ควรเป็น ${expected ?? "?"})`);
    }
    if (!name) fail("ไม่มีชื่อห้อง (Room)");
    else if (name.length > 191) fail("ชื่อห้องยาวเกิน 191 ตัวอักษร");
    if (!owner) fail("ไม่มีหน่วยงาน (Owner)");
    if (!Number.isInteger(capacity) || capacity < 1) fail(`Current_Seat "${get("capacity")}" ต้องเป็นจำนวนเต็มตั้งแต่ 1`);
    if (!Number.isFinite(price) || price < 0) fail(`PerHour "${get("pricePerHour")}" ต้องเป็นตัวเลขไม่ติดลบ`);

    const firstLine = seenCodes.get(code);
    if (code && firstLine !== undefined) fail(`Room_ID "${code}" ซ้ำกับแถว ${firstLine}`);
    else if (code) seenCodes.set(code, line);

    if (errors.length > before) continue;

    // pricePerHour is whole baht in the database.
    const pricePerHour = Math.round(price);
    if (pricePerHour !== price) warnings.push({ line, message: `PerHour ${price} ถูกปัดเป็น ${pricePerHour} บาท` });

    rooms.push({
      line,
      code,
      roomType,
      roomNumber: code.slice(-2),
      name,
      owner,
      building,
      floor,
      capacity,
      pricePerHour,
    });
  }

  if (!rooms.length && !errors.length) errors.push({ line: headerIndex + 1, message: "ไม่พบแถวข้อมูลห้อง" });
  return { rooms, errors, warnings };
}

/** Same "หน่วยงาน - อาคาร X ชั้น Y" description the room form writes. */
export function importDescription(room: Pick<ImportRoom, "owner" | "building" | "floor">): string {
  return `${room.owner} - อาคาร ${room.building} ชั้น ${room.floor}`;
}

/** Room admins are named after their unit ("Admin - หน่วยงาน") or the unit itself. */
export function ownerKey(name: string): string {
  return name.replace(/^admin\s*-\s*/i, "").replace(/\s+/g, " ").trim();
}
