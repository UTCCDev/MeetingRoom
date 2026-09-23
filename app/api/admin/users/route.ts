import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { emailSchema, firstError, nameSchema, passwordSchema } from "@/lib/validation";

const ROLES = ["USER", "ROOM_ADMIN", "SYSTEM_ADMIN"] as const;
const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;
const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";

async function requireSystemAdmin(forbiddenMessage: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return { error: NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 }) };
  }

  if ((session.user as any).role !== "SYSTEM_ADMIN") {
    return { error: NextResponse.json({ error: forbiddenMessage }, { status: 403 }) };
  }

  return { userId: (session.user as any).id as string };
}

// GET all users
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemAdmin("เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าถึงส่วนนี้ได้");
    if (auth.error) return auth.error;

    const users = await prisma.user.findMany({
      select: USER_FIELDS,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

const updateUserSchema = z.object({
  userId: z.string().min(1, "รหัสผู้ใช้ไม่ถูกต้อง"),
  newRole: z.enum(ROLES, { errorMap: () => ({ message: "บทบาทไม่ถูกต้อง" }) }).optional(),
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  active: z.boolean().optional(),
});

// PUT update a user: role, name, email, password reset, enable/disable
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSystemAdmin("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขผู้ใช้ได้");
    if (auth.error) return auth.error;

    const parsed = updateUserSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const { userId, newRole, name, email, password, active } = parsed.data;
    const isSelf = userId === auth.userId;

    if (isSelf && newRole && newRole !== "SYSTEM_ADMIN") {
      return NextResponse.json(
        { error: "คุณไม่สามารถลดบทบาทของตัวเองได้ กรุณาให้ผู้ดูแลระบบท่านอื่นเป็นผู้แก้ไข" },
        { status: 400 }
      );
    }

    if (isSelf && active === false) {
      return NextResponse.json({ error: "คุณไม่สามารถปิดบัญชีของตัวเองได้" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้นี้" }, { status: 404 });
    }

    const losesAdmin =
      targetUser.role === "SYSTEM_ADMIN" &&
      ((newRole && newRole !== "SYSTEM_ADMIN") || active === false);

    if (losesAdmin) {
      const activeAdminCount = await prisma.user.count({
        where: { role: "SYSTEM_ADMIN", active: true },
      });

      if (activeAdminCount <= 1) {
        return NextResponse.json(
          { error: "ระบบต้องมีผู้ดูแลระบบ (System Admin) อย่างน้อย 1 คนเสมอ" },
          { status: 400 }
        );
      }
    }

    if (email && email !== targetUser.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(newRole && { role: newRole }),
        ...(name && { name }),
        ...(email && { email }),
        ...(password && { password: await bcrypt.hash(password, 10) }),
        ...(active !== undefined && { active }),
      },
      select: USER_FIELDS,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  role: z.enum(ROLES, { errorMap: () => ({ message: "บทบาทไม่ถูกต้อง" }) }).default("USER"),
});

// POST create new user (by system admin)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemAdmin("เฉพาะผู้ดูแลระบบเท่านั้นที่สร้างผู้ใช้ได้");
    if (auth.error) return auth.error;

    const parsed = createUserSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const { email, name, password, role } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: await bcrypt.hash(password, 10),
        role,
      },
      select: USER_FIELDS,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
