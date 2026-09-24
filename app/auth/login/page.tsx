"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./login.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MICROSOFT_PROVIDER = "azure-ad";

// next-auth redirects back with ?error=<code> when an OAuth sign-in fails.
const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "บัญชี Microsoft 365 นี้ไม่มีสิทธิ์เข้าใช้ระบบ หรือบัญชีถูกระงับ",
  OAuthAccountNotLinked: "อีเมลนี้เชื่อมกับวิธีเข้าสู่ระบบอื่นอยู่แล้ว",
};
const DEFAULT_OAUTH_ERROR = "เข้าสู่ระบบด้วย Microsoft 365 ไม่สำเร็จ กรุณาลองใหม่";

// Only same-site relative paths, so the login page can't be used as an open redirect.
function safeCallbackUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("callbackUrl") || "/";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasMicrosoft, setHasMicrosoft] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      setNotice("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ");
    }
    // Credentials failures are handled inline (redirect: false), so any error here is from SSO.
    const oauthError = params.get("error");
    if (oauthError) {
      setError(OAUTH_ERRORS[oauthError] ?? DEFAULT_OAUTH_ERROR);
    }

    getProviders()
      .then((providers) => setHasMicrosoft(!!providers?.[MICROSOFT_PROVIDER]))
      .catch(() => setHasMicrosoft(false));
  }, []);

  const handleMicrosoftSignIn = async () => {
    setError("");
    // The button is shown before the Entra ID app is set up (AZURE_AD_* in .env).
    if (!hasMicrosoft) {
      setError("การเข้าสู่ระบบด้วย Microsoft 365 ยังไม่เปิดใช้งาน กรุณาใช้อีเมลและรหัสผ่าน");
      return;
    }
    setIsSsoLoading(true);
    try {
      // Full-page redirect to Microsoft; we only get back here if it fails to start.
      await signIn(MICROSOFT_PROVIDER, { callbackUrl: safeCallbackUrl() });
    } catch {
      setError(DEFAULT_OAUTH_ERROR);
      setIsSsoLoading(false);
    }
  };

  const isBusy = isLoading || isSsoLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (result?.ok) {
        router.push(safeCallbackUrl());
        router.refresh();
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดบางประการ");
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError("");

  return (
    <div className="login">
      <aside className="login__brand">
        <div className="login__logo">
          {/* UTCC RoomSync logo, all-white variant for the primary brand panel. */}
          <img src="/brand/roomsync-logo-on-primary.svg" alt="UTCC RoomSync ระบบจองห้องประชุม" width={635} height={241} />
        </div>
        <div>
          <div className="login__overline">ระบบงานภายใน</div>
          <h1 className="login__headline">ยินดีต้อนรับกลับมา</h1>
          <p className="login__lede">
            <span className="login__phrase">จองห้องประชุมส่วนกลาง</span>{" "}
            <span className="login__phrase">ตรวจสอบห้องว่าง</span>{" "}
            <span className="login__phrase">และติดตามสถานะการจอง</span>
            <span className="login__phrase">ได้ในที่เดียว</span>
          </p>
        </div>
        <div className="login__legal">© {new Date().getFullYear()} ระบบจองห้องประชุมส่วนกลาง</div>
      </aside>

      <main className="login__main">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div>
            <h2 className="login__title">เข้าสู่ระบบ</h2>
            <p className="login__subtitle">ใช้อีเมลและรหัสผ่านของคุณเพื่อเข้าสู่ระบบ</p>
          </div>

          {notice && !error && (
            <div className="alert alert--success" role="status">
              {notice}
            </div>
          )}

          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="login-email">
              <span>อีเมล</span>
            </label>
            <div className="field__control">
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                className="field__input"
                placeholder="example@utcc.ac.th"
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="login-password">
              <span>รหัสผ่าน</span>
            </label>
            <div className="field__control">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                className="field__input field__input--with-toggle"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-controls="login-password"
              >
                {showPassword ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            aria-busy={isLoading || undefined}
            className="btn btn--filled btn--l btn--block"
          >
            {isLoading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>

          <div className="divider">หรือ</div>

          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={isBusy}
            aria-busy={isSsoLoading || undefined}
            className="btn btn--outlined btn--l btn--block"
          >
            <span className="ms-logo" aria-hidden="true">
              <span /><span /><span /><span />
            </span>
            {isSsoLoading ? "กำลังเชื่อมต่อ Microsoft 365…" : "เข้าสู่ระบบด้วย Microsoft 365"}
          </button>

          <div className="divider">ยังไม่มีบัญชี?</div>

          <Link href="/auth/register" className="btn btn--outlined btn--l btn--block">
            ลงทะเบียนบัญชีใหม่
          </Link>

          {/* Demo accounts. TODO: remove this box and the seed users before going live. */}
          <div className="login__demo">
            <p className="login__demo-title">ข้อมูลสำหรับทดสอบ (รหัสผ่าน: password)</p>
            <dl className="login__demo-list">
              <dt>ผู้ใช้ทั่วไป</dt>
              <dd>user@example.com</dd>
              <dt>ผู้ดูแลห้อง</dt>
              <dd>admin@example.com</dd>
              <dt>ผู้ดูแลระบบ</dt>
              <dd>system@example.com</dd>
            </dl>
          </div>
        </form>
      </main>
    </div>
  );
}
