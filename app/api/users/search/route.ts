import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/search?q= — pick who a booking is for. Signed-in users only; never returns more than name/email/department.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);

  try {
    const users = await prisma.user.findMany({
      where: { active: true, OR: [{ name: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 10,
    });
    return NextResponse.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, department: u.department?.name ?? null })));
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "ค้นหาผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}
