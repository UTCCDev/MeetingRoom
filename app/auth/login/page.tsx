"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (result?.ok) {
        router.push("/");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดบางประการ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full border-t-4 border-blue-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-700 mb-2">
            ระบบจองห้อง
          </h1>
          <p className="text-gray-600">
            ระบบจองห้องประชุมแบบรวมศูนย์
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              อีเมล
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="example@utcc.ac.th"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            ยังไม่มีบัญชี?{" "}
            <Link href="/auth/register" className="font-semibold text-blue-700 hover:text-blue-800 hover:underline">
              ลงทะเบียนที่นี่
            </Link>
          </p>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold mb-3 text-center text-blue-700">
            🔐 ข้อมูลสำหรับทดสอบ:
          </p>
          <div className="space-y-2 text-xs text-gray-700">
            <div className="bg-white p-2 rounded">
              <p className="font-semibold text-blue-700">ผู้ใช้ทั่วไป:</p>
              <p>user@example.com / password</p>
            </div>
            <div className="bg-white p-2 rounded">
              <p className="font-semibold text-blue-700">ผู้ดูแลห้อง:</p>
              <p>admin@example.com / password</p>
            </div>
            <div className="bg-white p-2 rounded">
              <p className="font-semibold text-blue-700">ผู้ดูแลระบบ:</p>
              <p>system@example.com / password</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
