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

export type PhotoTopic = "round" | "board" | "ushape" | "theater" | "seating" | "presentation" | "whiteboard" | "video" | "entrance";

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
  entrance: [
    { src: "/room-photos/entrance-1.jpg", title: "Small Meeting Room 101, Light Cube Utsunomiya", creator: "Miyuki Meinaka", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/w/index.php?curid=154418453" },
    { src: "/room-photos/entrance-2.jpg", title: "Meeting Room sign (3619639831)", creator: "Bonner Springs Library", license: "CC BY 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=109253868" },
    { src: "/room-photos/entrance-3.jpg", title: "477 Richmond - small meeting rooms (5277779245)", creator: "Mike Beltzner", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/w/index.php?curid=62268007" },
  ],
};
