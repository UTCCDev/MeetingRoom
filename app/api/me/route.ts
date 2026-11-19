import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Current user. Lives outside /api/auth/* because that path belongs to
// NextAuth's catch-all route.
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const user = session.user as any;
  // Read fresh: an admin may have changed the department after sign-in.
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true } });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: row?.departmentId ?? null,
  });
}
