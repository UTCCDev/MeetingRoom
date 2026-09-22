import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, name, password } = await request.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "\u0e2b\u0e32\u0e22\u0e44\u0e1b\u0e1a\u0e32\u0e07\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e35\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e21\u0e35\u0e2d\u0e22\u0e39\u0e41\u0e25\u0e49\u0e27" },
        { status: 400 }
      );
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
      { message: "\u0e2d\u0e39\u0e04\u0e15\u0e35\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e15\u0e23\u0e33\u0e48\u0e21\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e41\u0e25\u0e49\u0e27", user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e41\u0e14\u0e01\u0e01\u0e25\u0e32\u0e07\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e2d\u0e2d\u0e23\u0e4c" },
      { status: 500 }
    );
  }
}
