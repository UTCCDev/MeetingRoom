import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Extra room approvers must be active ROOM_ADMIN/SYSTEM_ADMIN accounts, so they
 * already have the "อนุมัติการจอง" page. Returns an error response, or null when valid.
 */
export async function checkApprovers(ids: string[] | undefined): Promise<NextResponse | null> {
  if (!ids || ids.length === 0) return null;
  const unique = [...new Set(ids)];
  const found = await prisma.user.count({
    where: { id: { in: unique }, active: true, role: { in: ["ROOM_ADMIN", "SYSTEM_ADMIN"] } },
  });
  if (found !== unique.length) {
    return NextResponse.json(
      { error: "ผู้อนุมัติต้องเป็นผู้ดูแลห้องหรือผู้ดูแลระบบที่ยังใช้งานอยู่", field: "approverIds" },
      { status: 400 }
    );
  }
  return null;
}
