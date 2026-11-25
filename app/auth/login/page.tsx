"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";
import "./login.css";

const MICROSOFT_PROVIDER = "azure-ad";

// next-auth redirects back with ?error=<code> when an OAuth sign-in fails.
const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "บัญชี Microsoft 365 นี้ไม่มีสิทธิ์เข้าใช้ระบบ หรือบัญชีถูกระงับ",
  OAuthAccountNotLinked: "อีเมลนี้เชื่อมกับวิธีเข้าสู่ระบบอื่นอยู่แล้ว",
};
const DEFAULT_OAUTH_ERROR = "เข้าสู่ระบบด้วย Microsoft 365 ไม่สำเร็จ กรุณาลองใหม่";

// Lucide-style 24px stroke icons.
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const CircleAlertIcon = () => (
  <Icon><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></Icon>
);
const ShieldCheckIcon = () => (
  <Icon>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const DoorIcon = () => (
  <Icon><path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" /></Icon>
);
const CalendarIcon = () => (
  <Icon><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /></Icon>
);
const ArrowLeftIcon = () => (
  <Icon><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></Icon>
);
const BellIcon = () => (
  <Icon><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></Icon>
);

// What the system does, shown under the button so a single-button card doesn't feel empty.
const HIGHLIGHTS = [
  { icon: <DoorIcon />, label: "ดูห้องว่าง" },
  { icon: <CalendarIcon />, label: "จองในไม่กี่คลิก" },
  { icon: <BellIcon />, label: "แจ้งผลอนุมัติ" },
];

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
  const [error, setError] = useState("");
  const [hasMicrosoft, setHasMicrosoft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get("error");
    if (oauthError) setError(OAUTH_ERRORS[oauthError] ?? DEFAULT_OAUTH_ERROR);

    getProviders()
      .then((providers) => setHasMicrosoft(!!providers?.[MICROSOFT_PROVIDER]))
      .catch(() => setHasMicrosoft(false));
  }, []);

  const handleSignIn = async () => {
    setError("");
    // The button is shown before the Entra ID app is set up (AZURE_AD_* in .env).
    if (!hasMicrosoft) {
      setError("การเข้าสู่ระบบด้วย Microsoft 365 ยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }
    setIsLoading(true);
    try {
      // Full-page redirect to Microsoft; we only get back here if it fails to start.
      await signIn(MICROSOFT_PROVIDER, { callbackUrl: safeCallbackUrl() });
    } catch {
      setError(DEFAULT_OAUTH_ERROR);
      setIsLoading(false);
    }
  };

  return (
    <div className="login">
      <Link href="/" className="login__back">
        <ArrowLeftIcon />
        กลับหน้าหลัก
      </Link>
      <img className="login__shield" src="/brand/utcc-shield-stroke-white.svg" alt="" aria-hidden="true" />

      <main className="login__stage">
        <img className="login__logo" src="/brand/utcc-meetingroom-white.svg" alt="UTCC Meeting Room" width={226} height={80} />

        <section className="login__card" aria-labelledby="login-title">
          <div className="login__overline">ระบบจองห้องประชุม</div>
          <h1 id="login-title" className="login__title">เข้าสู่ระบบ</h1>
          <p className="login__subtitle">
            <span className="login__phrase">ห้องประชุมทั้งมหาวิทยาลัย</span>{" "}
            <span className="login__phrase">พร้อมให้คุณจอง</span>{" "}
            <span className="login__phrase">ด้วยบัญชีเดียว</span>
          </p>

          {error && (
            <p className="alert alert--error" role="alert">
              <CircleAlertIcon />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            className="btn btn--filled btn--l btn--block"
          >
            <span className="m365-logo" aria-hidden="true">
              <img src="/brand/microsoft-365.svg" alt="" width={20} height={20} />
            </span>
            {isLoading ? "กำลังเชื่อมต่อ Microsoft 365…" : "เข้าสู่ระบบด้วย Microsoft 365"}
          </button>

          <p className="login__note">
            <ShieldCheckIcon />
            ใช้บัญชี @utcc.ac.th ยืนยันตัวตนผ่าน Microsoft อย่างปลอดภัย
          </p>

          <ul className="login__highlights">
            {HIGHLIGHTS.map((h) => (
              <li key={h.label}>
                {h.icon}
                <span>{h.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="login__quote">“ประชุมได้ตรงเวลา เริ่มจากห้องที่พร้อม”</p>
      </main>

      <footer className="login__legal">© {new Date().getFullYear() + 543} มหาวิทยาลัยหอการค้าไทย สงวนลิขสิทธิ์</footer>
    </div>
  );
}
