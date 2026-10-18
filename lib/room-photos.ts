/**
 * Sample photos of meeting rooms (not photos of the actual rooms), self-hosted in
 * public/room-photos. Found via Openverse; CC BY / BY-SA photos must keep their credit,
 * which the gallery shows under each photo.
 */

export interface RoomPhoto {
  src: string;
  title: string;
  creator: string;
  license: string;
  source: string;
}

export type PhotoTopic =
  | "round" | "board" | "ushape" | "theater" | "seating" | "presentation" | "whiteboard" | "video" | "entrance"
  | "tv" | "printer" | "microphone";

export const ROOM_PHOTOS: Record<PhotoTopic, RoomPhoto[]> = {
  round: [
    { src: "/room-photos/round-1.jpg", title: "Free meeting table image", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5917105/photo-image-public-domain-table-room" },
    { src: "/room-photos/round-2.jpg", title: "Bengal Club small meeting room", creator: "BengalClub1827", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=110696553" },
    { src: "/room-photos/round-3.jpg", title: "Empty office meeting room", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5927697/photo-image-public-domain-business-room" },
  ],
  board: [
    { src: "/room-photos/board-1.jpg", title: "Free meeting room image", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5903640/photo-image-public-domain-room-office" },
    { src: "/room-photos/board-2.jpg", title: "conference room table chairs", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/3337630/free-photo-image-boardroom-conference-office-background" },
    { src: "/room-photos/board-3.jpg", title: "Empty office meeting room", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5926926/photo-image-public-domain-business-room" },
  ],
  ushape: [
    { src: "/room-photos/ushape-1.jpg", title: "Empty office meeting room", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5914070/image-public-domain-business-room" },
    { src: "/room-photos/ushape-2.jpg", title: "Empty office meeting room", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5927397/photo-image-public-domain-business-room" },
    { src: "/room-photos/ushape-3.jpg", title: "Edinburgh Futures Institute seminar room", creator: "Arcaist", license: "CC BY 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=149834923" },
  ],
  theater: [
    { src: "/room-photos/theater-1.jpg", title: "An empty conference room with rows of chairs facing a stage area. There are five gray chairs and two small tables on the stage, with a podium and microphone to the right. A large blank screen is mounted on the wall behind the stage. The room has gray walls and a ceiling-mounted projector.", creator: "Nilo Velez", license: "CC0", source: "https://wordpress.org/photos/photo/5176786995/" },
    { src: "/room-photos/theater-2.jpg", title: "An empty conference room with rows of brown chairs facing a small stage, under an overhead grid-patterned ceiling with recessed lighting. The walls are wooden with a speaker mounted on one side.", creator: "Nilo Velez", license: "CC0", source: "https://wordpress.org/photos/photo/268678e0be/" },
    { src: "/room-photos/theater-3.jpg", title: "Classroom School image", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5917120/image-public-domain-table-room" },
  ],
  seating: [
    { src: "/room-photos/seating-1.jpg", title: "row chairs long table conference", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/3303716/free-photo-image-cafeteria-cc0-chair" },
    { src: "/room-photos/seating-2.jpg", title: "White chairs white table small", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/3283128/free-photo-image-office-chair-meeting-room-dining" },
    { src: "/room-photos/seating-3.jpg", title: "Office Work", creator: "Monoar Rahman", license: "CC0", source: "https://stocksnap.io/photo/office-work-WWF2RUV4E7" },
  ],
  presentation: [
    { src: "/room-photos/presentation-1.jpg", title: "Free classroom school image", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/5924914/photo-image-public-domain-table-room" },
    { src: "/room-photos/presentation-2.jpg", title: "WordCamp US 2023 conference presentation set up with a projector screen on the left titled “The Enterprise Approach to WordPress Security” and an empty podium and table and chairs to the right", creator: "Jeffrey Paul", license: "CC0", source: "https://wordpress.org/photos/photo/757666894b/" },
  ],
  whiteboard: [
    { src: "/room-photos/whiteboard-1.jpg", title: "conference room whiteboard its brick", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/3303642/free-photo-image-bedroom-cc0-chair" },
    { src: "/room-photos/whiteboard-2.jpg", title: "bright conference room two whiteboards", creator: "", license: "CC0", source: "https://www.rawpixel.com/image/3282916/free-photo-image-office-home-background" },
    { src: "/room-photos/whiteboard-3.jpg", title: "Whiteboard in seminar room", creator: "Schreibwaren-Upload", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=156001304" },
  ],
  video: [
    { src: "/room-photos/video-1.jpg", title: "Video conference room (3570807285)", creator: "Mike Beltzner", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=62268008" },
    { src: "/room-photos/video-2.jpg", title: "Polycom VSX 7000 with 2 video conferencing screens", creator: "BrokenSphere", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/w/index.php?curid=4234466" },
  ],
  tv: [
    { src: "/room-photos/tv-1.jpg", title: "Round Table, chairs, TV monitor, conference room", creator: "Wonderlane", license: "CC0", source: "https://www.flickr.com/photos/71401718@N00/5526839767" },
  ],
  printer: [
    { src: "/room-photos/printer-1.jpg", title: "Brother HL-2070N Network Laser Printer", creator: "liewcf", license: "CC BY-SA 2.0", source: "https://www.flickr.com/photos/34353636@N00/449602815" },
    { src: "/room-photos/printer-2.jpg", title: "Kyocera Office Printer Maschine", creator: "Mr.ちゅらさん", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=111210259" },
  ],
  microphone: [
    { src: "/room-photos/microphone-1.jpg", title: "GONSIN TL-4200 Conference Microphone", creator: "LiPeihua91", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=51910728" },
    { src: "/room-photos/microphone-2.jpg", title: "MXL AC404 USB Conference Microphone", creator: "shop8447", license: "CC0", source: "https://www.flickr.com/photos/185514373@N06/49060722517" },
  ],
  entrance: [
    { src: "/room-photos/entrance-1.jpg", title: "Small Meeting Room 101, Light Cube Utsunomiya", creator: "Miyuki Meinaka", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=154418453" },
    { src: "/room-photos/entrance-2.jpg", title: "Meeting Room sign (3619639831)", creator: "Bonner Springs Library", license: "CC BY 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=109253868" },
    { src: "/room-photos/entrance-3.jpg", title: "477 Richmond - small meeting rooms (5277779245)", creator: "Mike Beltzner", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=62268007" },
  ],
};

/** Room amenities, in form order; each one also has a photo slot of the same key. */
export const AMENITIES = ["projector", "whiteboard", "videoconference", "printer", "tv", "microphone"] as const;
export type Amenity = (typeof AMENITIES)[number];

/**
 * Detail shots a room can have its own photo for (the whole-room shot is Room.image):
 * seating and entrance for every room, plus one per amenity.
 */
export const PHOTO_SHOTS = ["seating", ...AMENITIES, "entrance"] as const;
export type PhotoShot = (typeof PHOTO_SHOTS)[number];
export type RoomPhotos = Partial<Record<PhotoShot, string>>;

export const SHOT_INFO: Record<PhotoShot, { title: string; tip: string; topic: PhotoTopic }> = {
  seating: { title: "ที่นั่ง", tip: "ถ่ายระดับสายตาคนนั่ง ให้เห็นเก้าอี้และโต๊ะชัด ๆ", topic: "seating" },
  projector: { title: "โปรเจกเตอร์", tip: "เปิดโปรเจกเตอร์ให้มีภาพบนจอ แล้วถ่ายจากที่นั่งแถวหลัง", topic: "presentation" },
  whiteboard: { title: "กระดานไวท์บอร์ด", tip: "ลบกระดานให้สะอาด ถ่ายเฉียงเล็กน้อยเพื่อเลี่ยงแสงสะท้อน", topic: "whiteboard" },
  videoconference: { title: "ระบบวิดีโอคอนเฟอเรนซ์", tip: "ให้เห็นกล้อง ลำโพง และจอในภาพเดียว", topic: "video" },
  printer: { title: "เครื่องพิมพ์", tip: "ถ่ายเครื่องพิมพ์ทั้งเครื่อง ให้เห็นตำแหน่งที่ตั้งในห้อง", topic: "printer" },
  tv: { title: "โทรทัศน์ / จอมอนิเตอร์", tip: "เปิดจอให้มีภาพ ถ่ายให้เห็นขนาดจอเทียบกับโต๊ะ", topic: "tv" },
  microphone: { title: "ไมโครโฟน", tip: "ถ่ายไมโครโฟนบนโต๊ะประชุม ให้เห็นจำนวนและตำแหน่งที่วาง", topic: "microphone" },
  entrance: { title: "หน้าห้อง", tip: "ถ่ายป้ายชื่อหรือเลขห้อง ช่วยให้ผู้จองหาห้องเจอ", topic: "entrance" },
};

/**
 * Generated mock-ups showing how to shoot each slot, for the room guide and the room form's photo
 * slots (room cards keep the samples above). No source on purpose: the UI then labels them
 * "ภาพจำลองการถ่ายรูป" instead of a credit.
 */
const mockup = (src: string, title: string): RoomPhoto => ({ src, title, creator: "", license: "", source: "" });
export const COVER_MOCKUP = mockup("/room-photos/cover-guide.jpg", "ภาพจำลองห้องประชุมโต๊ะยาว");
export const SHOT_MOCKUPS: Record<PhotoShot, RoomPhoto> = {
  seating: mockup("/room-photos/seating-guide.jpg", "ภาพจำลองที่นั่งระดับสายตา"),
  projector: mockup("/room-photos/projector-guide.jpg", "ภาพจำลองโปรเจกเตอร์และจอภาพ"),
  whiteboard: mockup("/room-photos/whiteboard-guide.jpg", "ภาพจำลองกระดานไวท์บอร์ด"),
  videoconference: mockup("/room-photos/videoconference-guide.jpg", "ภาพจำลองกล้อง ลำโพง และจอวิดีโอคอนเฟอเรนซ์"),
  printer: mockup("/room-photos/printer-guide.jpg", "ภาพจำลองเครื่องพิมพ์ในห้องประชุม"),
  tv: mockup("/room-photos/tv-guide.jpg", "ภาพจำลองจอโทรทัศน์เทียบกับโต๊ะ"),
  microphone: mockup("/room-photos/microphone-guide.jpg", "ภาพจำลองไมโครโฟนบนโต๊ะประชุม"),
  entrance: mockup("/room-photos/entrance-guide.jpg", "ภาพจำลองหน้าห้องและป้ายชื่อห้อง"),
};

/**
 * Generated mock-ups for the room cards (search and room management) of rooms without their own
 * photo, by layout; see layoutTopic. Not for the room's photo gallery, which keeps the credited
 * samples above.
 */
export const CARD_MOCKUPS: Partial<Record<PhotoTopic, RoomPhoto[]>> = {
  round: [
    mockup("/room-photos/card-small.jpg", "ภาพจำลองห้องประชุมย่อย"),
    mockup("/room-photos/card-round.jpg", "ภาพจำลองห้องประชุมโต๊ะกลม"),
  ],
  board: [mockup("/room-photos/card-board.jpg", "ภาพจำลองห้องประชุมโต๊ะยาว")],
  ushape: [mockup("/room-photos/card-ushape.jpg", "ภาพจำลองห้องประชุมรูปตัวยู")],
  theater: [
    mockup("/room-photos/card-theater-1.jpg", "ภาพจำลองห้องสัมมนา"),
    mockup("/room-photos/card-theater-2.jpg", "ภาพจำลองห้องสัมมนา"),
  ],
};

// Photos saved before each amenity had its own slot.
const LEGACY_SHOTS: Record<string, PhotoShot> = { presentation: "projector", video: "videoconference" };

/** Room.photos comes back from the API as untyped JSON; keep only non-empty known shots. */
export function parseRoomPhotos(value: unknown): RoomPhotos {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: RoomPhotos = {};
  for (const [key, url] of Object.entries(value as Record<string, unknown>)) {
    const shot = (PHOTO_SHOTS as readonly string[]).includes(key) ? (key as PhotoShot) : LEGACY_SHOTS[key];
    if (shot && typeof url === "string" && url.trim() && !out[shot]) out[shot] = url.trim();
  }
  return out;
}

/** A room photo is empty, an http(s) URL, or a file uploaded through /api/uploads. */
export const isPhotoUrl = (s: string) =>
  s.trim() === "" || /^https?:\/\//i.test(s.trim()) || /^\/api\/uploads\/[\w.-]+$/.test(s.trim());
export const PHOTO_URL_ERROR = "ต้องเป็นไฟล์ที่อัปโหลด หรือ URL ที่ขึ้นต้นด้วย http:// หรือ https://";

/** Amenities as stored (array) or typed in the room admin's comma-separated field. */
export function amenityKeys(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return list.map((a) => String(a).trim()).filter(Boolean);
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

export function pick(topic: PhotoTopic, seed: number, pools: Partial<Record<PhotoTopic, RoomPhoto[]>> = ROOM_PHOTOS): RoomPhoto {
  const pool = pools[topic] ?? ROOM_PHOTOS[topic];
  return pool[seed % pool.length];
}

/** The room card's photo: its own image, else a mock-up matching its size. Safe to call from server components. */
export function roomCover(room: { id: string; capacity: number; image?: string | null }): string {
  return room.image || pick(layoutTopic(room.capacity).topic, hash(room.id), CARD_MOCKUPS).src;
}

