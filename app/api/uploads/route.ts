import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { UPLOAD_DIR, UPLOAD_MAX_BYTES, imageType } from "@/lib/uploads";

// POST a room photo (multipart field "file"); returns { url } to store on the room.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }
    if (role !== "ROOM_ADMIN" && role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์อัปโหลดรูป" }, { status: 403 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์รูป" }, { status: 400 });
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 5 MB" }, { status: 400 });
    }

    // Trust the file's bytes, not its name or the browser's content type.
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP" }, { status: 400 });
    }

    const name = `${randomUUID()}.${type.ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), bytes);

    return NextResponse.json({ url: `/api/uploads/${name}` }, { status: 201 });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
