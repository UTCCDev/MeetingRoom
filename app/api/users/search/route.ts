import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 20;

// GET /api/users/search?q= — the "จองเพื่อ" dropdown. Empty q lists the first users by name.
// Signed-in users only; never returns more than name/email/department.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100);

  try {
    const users = await prisma.user.findMany({
      where: q ? { active: true, OR: [{ name: { contains: q } }, { email: { contains: q } }] } : { active: true },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: LIMIT,
    });
    return NextResponse.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, department: u.department?.name ?? null })));
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "ค้นหาผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}
