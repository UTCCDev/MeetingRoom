import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, UPLOAD_NAME, imageType } from "@/lib/uploads";

// GET an uploaded room photo. Names are random UUIDs, so files never change.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!UPLOAD_NAME.test(name)) {
    return NextResponse.json({ error: "ไม่พบรูป" }, { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": imageType(bytes)?.mime || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "ไม่พบรูป" }, { status: 404 });
  }
}
