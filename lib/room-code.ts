// Room codes classify rooms as <type prefix><building 2 digits><floor 2 digits><room 2 digits>,
// e.g. M030401 = Meeting room, building 03, floor 04, room 01.

export const ROOM_TYPES = ["MEETING", "EVENT", "SEMINAR"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_PREFIX: Record<RoomType, string> = {
  MEETING: "M",
  EVENT: "E",
  SEMINAR: "S",
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  MEETING: "ห้องประชุม (M)",
  EVENT: "ห้องจัดงาน (E)",
  SEMINAR: "ห้องสัมมนา (S)",
};

// Floors with a letter ("12A") take 3 characters, so building and room number
// stay fixed at 2 digits to keep the code unambiguous.
export const ROOM_CODE_PATTERN = /^[MES]\d{2}[0-9A-Z]{2,3}\d{2}$/;

/** Returns the room code, or null when building/floor/room number are missing or not code-safe. */
export function buildRoomCode(
  roomType: RoomType,
  building: string,
  floor: string,
  roomNumber: string
): string | null {
  const b = building.trim();
  const f = floor.trim().toUpperCase();
  const r = roomNumber.trim();
  if (!/^\d{1,2}$/.test(b) || !/^[0-9A-Z]{1,3}$/.test(f) || !/^\d{1,2}$/.test(r)) return null;
  return `${ROOM_TYPE_PREFIX[roomType]}${b.padStart(2, "0")}${f.padStart(2, "0")}${r.padStart(2, "0")}`;
}
