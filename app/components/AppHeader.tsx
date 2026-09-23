"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import LogoutButton from "./LogoutButton";

const ROLE_LABELS: Record<string, string> = {
  USER: "ผู้ใช้ทั่วไป",
  ROOM_ADMIN: "ผู้ดูแลห้อง",
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
};

const NAV: { href: string; label: string; roles?: string[] }[] = [
  { href: "/rooms", label: "ค้นหาห้อง" },
  { href: "/my-bookings", label: "การจองของฉัน" },
  { href: "/admin/pending-approvals", label: "อนุมัติการจอง", roles: ["ROOM_ADMIN", "SYSTEM_ADMIN"] },
  { href: "/admin/my-rooms", label: "ห้องของฉัน", roles: ["ROOM_ADMIN"] },
  { href: "/admin/dashboard", label: "แดชบอร์ด", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/users", label: "ผู้ใช้", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/rooms", label: "จัดการห้อง", roles: ["SYSTEM_ADMIN"] },
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
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="text-lg sm:text-xl font-bold text-blue-700 whitespace-nowrap">
          ระบบจองห้องประชุม
        </Link>

        <nav className="hidden lg:flex items-center gap-1 flex-1" aria-label="เมนูหลัก">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                isActive(n.href) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-gray-800">{user.name}</span>
              <span className="text-xs text-gray-500">{ROLE_LABELS[role || ""] || role}</span>
            </div>
          )}
          <LogoutButton />
          <button
            type="button"
            className="lg:hidden w-10 h-10 rounded-lg border border-gray-300 text-gray-700"
            aria-label="เปิดเมนู"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="lg:hidden border-t border-gray-200 px-4 py-2 flex flex-col" aria-label="เมนูหลัก">
          {user && (
            <span className="sm:hidden text-sm text-gray-500 py-2">
              {user.name} · {ROLE_LABELS[role || ""] || role}
            </span>
          )}
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={`py-2 text-sm font-medium ${isActive(n.href) ? "text-blue-700" : "text-gray-700"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}

      {title && (
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500 mb-1" aria-label="breadcrumb">
                <li>
                  <Link href="/" className="hover:text-blue-700 hover:underline">หน้าหลัก</Link>
                </li>
                {breadcrumbs.map((c, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span aria-hidden="true">›</span>
                    {c.href ? (
                      <Link href={c.href} className="hover:text-blue-700 hover:underline">{c.label}</Link>
                    ) : (
                      <span className="text-gray-700">{c.label}</span>
                    )}
                  </li>
                ))}
              </ol>
              <h1 className="text-2xl md:text-3xl font-bold text-blue-700">{title}</h1>
            </div>
            {actions}
          </div>
        </div>
      )}
    </header>
  );
}
