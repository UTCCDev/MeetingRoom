"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../login/login.css";

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
    <div className="login">
      <aside className="login__brand">
        <div className="login__logo">
          {/* UTCC RoomSync logo, all-white variant for the primary brand panel. */}
          <img src="/brand/roomsync-logo-on-primary.svg" alt="UTCC RoomSync ระบบจองห้องประชุม" width={635} height={241} />
        </div>
        <div>
          <div className="login__overline">ระบบงานภายใน</div>
          <h1 className="login__headline">เริ่มต้นใช้งาน</h1>
          <p className="login__lede">
            <span className="login__phrase">สร้างบัญชีด้วยอีเมลมหาวิทยาลัย</span>{" "}
            <span className="login__phrase">แล้วจองห้องประชุมส่วนกลาง</span>
            <span className="login__phrase">ได้ทันที</span>
          </p>
        </div>
        <div className="login__legal">© {new Date().getFullYear()} ระบบจองห้องประชุมส่วนกลาง</div>
      </aside>

      <main className="login__main">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div>
            <h2 className="login__title">ลงทะเบียน</h2>
            <p className="login__subtitle">สร้างบัญชีผู้ใช้ใหม่เพื่อจองห้องประชุม</p>
          </div>

          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="register-name">
              <span>ชื่อ-สกุล</span>
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
              className="field__input"
              placeholder="นาย/นาง/นางสาว... (ชื่อ นามสกุล)"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="register-email">
              <span>อีเมล</span>
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="field__input"
              placeholder="example@utcc.ac.th"
              aria-describedby="register-email-hint"
            />
            <p id="register-email-hint" className="field__hint">
              ใช้อีเมลของมหาวิทยาลัย (@utcc.ac.th)
            </p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="register-password">
              <span>รหัสผ่าน</span>
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
              className="field__input"
              placeholder="••••••••"
              aria-describedby="register-password-hint"
            />
            <p id="register-password-hint" className="field__hint">
              อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร
            </p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="register-confirmPassword">
              <span>ยืนยันรหัสผ่าน</span>
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
              className="field__input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            className="btn btn--filled btn--l btn--block"
          >
            {isLoading ? "กำลังสร้างบัญชี..." : "ลงทะเบียน"}
          </button>

          <div className="divider">มีบัญชีแล้ว?</div>

          <Link href="/auth/login" className="btn btn--outlined btn--l btn--block">
            เข้าสู่ระบบ
          </Link>
        </form>
      </main>
    </div>
  );
}
