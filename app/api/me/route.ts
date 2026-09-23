import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Current user. Lives outside /api/auth/* because that path belongs to
// NextAuth's catch-all route.
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const user = session.user as any;
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}
