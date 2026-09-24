"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";

const ROLE_LABELS: Record<string, string> = {
  USER: "ผู้ใช้ทั่วไป",
  ROOM_ADMIN: "ผู้ดูแลห้อง",
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
};

const NAV: { href: string; label: string; icon: string; roles?: string[] }[] = [
  { href: "/rooms", label: "ค้นหาห้อง", icon: "meeting_room" },
  { href: "/my-bookings", label: "การจองของฉัน", icon: "event_note" },
  { href: "/admin/pending-approvals", label: "อนุมัติการจอง", icon: "fact_check", roles: ["ROOM_ADMIN", "SYSTEM_ADMIN"] },
  { href: "/admin/my-rooms", label: "ห้องของฉัน", icon: "edit_square", roles: ["ROOM_ADMIN"] },
  { href: "/admin/dashboard", label: "แดชบอร์ด", icon: "monitoring", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/users", label: "ผู้ใช้", icon: "group", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/rooms", label: "จัดการห้อง", icon: "domain", roles: ["SYSTEM_ADMIN"] },
];

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Shared top bar for every signed-in page: menu by role, current user,
 * logout, and a breadcrumb + page title row.
 */
export default function AppHeader({
  title,
  breadcrumbs = [],
  actions,
}: {
  title?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = session?.user as any;
  const role = user?.role as string | undefined;
  const items = NAV.filter((n) => !n.roles || (role && n.roles.includes(role)));

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <header className="bg-white border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-title-medium text-primary whitespace-nowrap">
          <span
            className="icon-tile bg-primary text-on-primary"
            aria-hidden="true"
          >
            <span className="icon icon--20 icon--w500 icon--fill">meeting_room</span>
          </span>
          <span className="hidden sm:inline">ระบบจองห้องประชุม</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 flex-1 self-stretch" aria-label="เมนูหลัก">
          {items.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 px-3 h-full text-label-large transition-colors ${
                  active
                    ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-xs after:bg-primary"
                    : "text-ink-muted hover:text-primary"
                }`}
              >
                <span className={`icon icon--20 ${active ? "icon--w500 icon--fill" : "icon--w300"}`} aria-hidden="true">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2.5">
              {/* Two tight lines (name / role) centred on the avatar. */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-label-large leading-none text-ink">{user.name}</span>
                <span className="text-label-medium leading-none text-ink-subtle">{ROLE_LABELS[role || ""] || role}</span>
              </div>
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-container text-on-primary-container"
                aria-hidden="true"
              >
                <span className="icon icon--24 icon--w300">person</span>
              </span>
            </div>
          )}
          {user?.id && (
            <NotificationBell userId={user.id} isApprover={role === "ROOM_ADMIN" || role === "SYSTEM_ADMIN"} />
          )}
          <LogoutButton />
          <button
            type="button"
            className="icon-button lg:hidden"
            aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="icon icon--24" aria-hidden="true">{menuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-nav" className="lg:hidden border-t border-line px-2 py-2 flex flex-col" aria-label="เมนูหลัก">
          {user && (
            <span className="sm:hidden px-3 py-2 text-body-small text-ink-subtle">
              {user.name} · {ROLE_LABELS[role || ""] || role}
            </span>
          )}
          {items.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 h-12 rounded-sm text-label-large ${
                  active ? "bg-primary-container text-on-primary-container" : "text-ink-muted hover:bg-canvas"
                }`}
              >
                <span className={`icon icon--24 ${active ? "icon--w500 icon--fill" : "icon--w300"}`} aria-hidden="true">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}

      {title && (
        <div className="bg-canvas border-t border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <ol className="flex flex-wrap items-center gap-1 text-body-small text-ink-subtle mb-1" aria-label="breadcrumb">
                <li>
                  <Link href="/" className="hover:text-primary hover:underline">หน้าหลัก</Link>
                </li>
                {breadcrumbs.map((c, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="icon icon--20 icon--w300" aria-hidden="true">chevron_right</span>
                    {c.href ? (
                      <Link href={c.href} className="hover:text-primary hover:underline">{c.label}</Link>
                    ) : (
                      <span className="text-ink-muted" aria-current="page">{c.label}</span>
                    )}
                  </li>
                ))}
              </ol>
              <h1 className="text-headline-small md:text-headline-medium text-ink">{title}</h1>
            </div>
            {actions}
          </div>
        </div>
      )}
    </header>
  );
}
