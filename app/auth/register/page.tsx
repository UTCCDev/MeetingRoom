"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PASSWORD_MIN_LENGTH = 8;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`);
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "การลงทะเบียนล้มเหลว");
        return;
      }

      router.push("/auth/login?registered=1");
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
            ลงทะเบียน
          </h1>
          <p className="text-gray-600">
            สร้างบัญชีผู้ใช้ใหม่เพื่อจองห้องประชุม
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg" role="alert">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ-สกุล
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className="input-field"
              placeholder="นาย/นาง/นางสาว... (ชื่อ นามสกุล)"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">
              อีเมล
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="input-field"
              placeholder="example@utcc.ac.th"
              aria-describedby="register-email-hint"
            />
            <p id="register-email-hint" className="text-xs text-gray-500 mt-1">
              ใช้อีเมลของมหาวิทยาลัย (@utcc.ac.th)
            </p>
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผ่าน
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="input-field"
              placeholder="••••••••"
              aria-describedby="register-password-hint"
            />
            <p id="register-password-hint" className="text-xs text-gray-500 mt-1">
              อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร
            </p>
          </div>

          <div>
            <label htmlFor="register-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              ยืนยันรหัสผ่าน
            </label>
            <input
              id="register-confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {isLoading ? "กำลังสร้างบัญชี..." : "ลงทะเบียน"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            มีบัญชีแล้ว?{" "}
            <Link href="/auth/login" className="font-semibold text-blue-700 hover:text-blue-800 hover:underline">
              เข้าสู่ระบบที่นี่
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
