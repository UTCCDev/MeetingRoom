import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  ALLOWED_EMAIL_DOMAINS,
  emailSchema,
  firstError,
  isAllowedEmailDomain,
  nameSchema,
  passwordSchema,
} from "@/lib/validation";

const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const { email, name, password } = parsed.data;

    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json(
        { error: `ลงทะเบียนได้เฉพาะอีเมล ${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}` },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "USER",
      },
    });

    return NextResponse.json(
      { message: "ลงทะเบียนสำเร็จแล้ว", user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
