"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";
import BackToTop from "./BackToTop";

const ROLE_LABELS: Record<string, string> = {
  USER: "ผู้ใช้ทั่วไป",
  ROOM_ADMIN: "ผู้ดูแลห้อง",
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
};

const NAV: { href: string; label: string; icon: string; roles?: string[] }[] = [
  { href: "/", label: "หน้าแรก", icon: "home" },
  { href: "/rooms", label: "ค้นหาห้อง", icon: "meeting_room" },
  { href: "/my-bookings", label: "การจองของฉัน", icon: "event_note" },
  { href: "/admin/pending-approvals", label: "อนุมัติการจอง", icon: "fact_check", roles: ["ROOM_ADMIN", "SYSTEM_ADMIN"] },
  { href: "/admin/my-rooms", label: "ห้องของฉัน", icon: "edit_square", roles: ["ROOM_ADMIN"] },
  { href: "/admin/dashboard", label: "แดชบอร์ด", icon: "monitoring", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/users", label: "ผู้ใช้", icon: "group", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/rooms", label: "จัดการห้อง", icon: "domain", roles: ["SYSTEM_ADMIN"] },
];

/**
 * Where the main menu lives: "sidebar" = fixed primary-blue panel on the left (≥1280px) and a
 * drawer from the left below that (same look as UTCC Store); "top" = the earlier horizontal menu in the top bar.
 */
const NAV_LAYOUT: "sidebar" | "top" = "sidebar";
const SIDEBAR = NAV_LAYOUT === "sidebar";

// Admin pages are grouped under their own heading in the sidebar.
const isAdminItem = (href: string) => href.startsWith("/admin/");

// Same idea for the sidebar's highlight pill: where it was on the previous page.
let lastPill: { top: number; height: number } | null = null;

// Every page mounts its own header, so the active underline's last position lives here:
// on the next page it starts where it was and slides to the new item.
let lastIndicator: { left: number; width: number } | null = null;

// useLayoutEffect warns during server rendering; it only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// UTCC DS › Graphic elements: one large outline shield, faint, behind the blue sidebar (decorative only).
function SidebarShield() {
  return (
    <img
      src="/brand/graphic/UTCC_Shield_StrokeL_White.svg"
      alt=""
      aria-hidden="true"
      className="pointer-events-none select-none absolute -left-20 bottom-24 w-[300px] h-auto opacity-[0.08]"
    />
  );
}

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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/");

  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.href = "/auth/login";
    }
  };

  // Sliding underline under the current menu item.
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState(lastIndicator);
  const [scrolled, setScrolled] = useState(false);

  useIsoLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !el || nav.offsetWidth === 0) return setIndicator(null);
      // Measure against the nav box itself (offsetLeft depends on which ancestor is positioned).
      const navBox = nav.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const next = { left: box.left - navBox.left + 12, width: box.width - 24 };
      lastIndicator = next;
      // Let the browser paint the old position first so the move animates.
      requestAnimationFrame(() => setIndicator(next));
    };
    measure();
    // Icon ligatures are wide text until the icon font loads, so measure again after
    // fonts load and whenever the menu changes size.
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    if (navRef.current) ro.observe(navRef.current);
    navRef.current?.querySelectorAll("a").forEach((a) => ro.observe(a));
    return () => ro.disconnect();
  }, [pathname, items.length]);

  // Sidebar: highlight pill behind the current item, sliding between pages.
  const sideRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState(lastPill);
  useIsoLayoutEffect(() => {
    if (!SIDEBAR) return;
    const measure = () => {
      const nav = sideRef.current;
      const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !el || nav.offsetWidth === 0) return setPill(null);
      const next = { top: el.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop, height: el.offsetHeight };
      lastPill = next;
      requestAnimationFrame(() => setPill(next));
    };
    measure();
    document.fonts?.ready.then(measure);
    // The user card appears once the session loads and pushes the items down.
    const ro = new ResizeObserver(measure);
    sideRef.current?.querySelectorAll(":scope > *").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [pathname, items.length, !!user]);

  // Drawer: Esc closes it, and the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!menuOpen || !SIDEBAR) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const roleLabel = ROLE_LABELS[role || ""] || role;
  const isApprover = role === "ROOM_ADMIN" || role === "SYSTEM_ADMIN";

  // ≥1280px: the sidebar is showing (matches Tailwind's xl).
  const [isXl, setIsXl] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsXl(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Sidebar content shared by the fixed panel and the phone drawer (UTCC Store pattern):
  // logo, menu groups, then the user card with logout pinned to the bottom.
  const sideNav = (withPill: boolean) => {
    const groups = [
      { label: null, items: items.filter((n) => !isAdminItem(n.href)) },
      { label: role === "SYSTEM_ADMIN" ? "ผู้ดูแลระบบ" : "ผู้ดูแลห้อง", items: items.filter((n) => isAdminItem(n.href)) },
    ].filter((g) => g.items.length > 0);
    return (
      <>
        <nav ref={withPill ? sideRef : undefined} className="relative px-3 py-2" aria-label="เมนูหลัก">
          {withPill && pill && (
            <span
              className="side-pill"
              style={{ transform: `translateY(${pill.top}px)`, height: pill.height }}
              aria-hidden="true"
            />
          )}
          {groups.map((g) => (
            <div key={g.label ?? "main"}>
              {g.label && (
                <p className="mt-5 mb-1 px-4 pt-4 border-t border-white/10 text-label-medium text-white/60">{g.label}</p>
              )}
              <ul className="flex flex-col gap-1">
                {g.items.map((n) => {
                  const active = isActive(n.href);
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`side-link group relative z-[1] flex items-center gap-3 px-4 min-h-11 rounded-full text-title-small font-light ${
                          active
                            ? `text-primary ${withPill ? "" : "bg-white"}`
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span
                          className={`icon icon--24 ${active ? "icon--filled text-primary" : "text-white/70 group-hover:text-white"}`}
                          aria-hidden="true"
                        >
                          {n.icon}
                        </span>
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto px-3 pb-3 pt-2">
          {/* User manual (PDF). TODO: link the file once it exists. */}
          <button
            type="button"
            className="group w-full flex items-center gap-3 px-4 min-h-11 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span className="icon icon--24 text-white/70 group-hover:text-white" aria-hidden="true">menu_book</span>
            <span className="text-title-small font-light">คู่มือการใช้งาน</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-label-small text-white/80 group-hover:bg-white/20">
              <span className="icon icon--20" aria-hidden="true">download</span>
              PDF
            </span>
          </button>
          {user && (
            <div className="mt-2 rounded-md bg-white/10 p-2.5 shadow-md">
              <div className="flex items-center gap-3 px-1 pb-2 border-b border-white/10">
                <span
                  className="flex-none inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-white/30 to-white/10 text-white shadow-md"
                  aria-hidden="true"
                >
                  <span className="icon icon--20">person</span>
                </span>
                <div className="min-w-0">
                  <p className="text-title-small text-white truncate" title={user.name}>{user.name}</p>
                  <p className="text-label-medium text-white/60 truncate">{roleLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="group mt-2 w-full flex items-center gap-3 px-3 py-1 rounded-sm text-title-small font-light text-white/80 hover:bg-red-500/20 hover:text-white transition-colors disabled:cursor-progress"
              >
                <span className="icon icon--24 text-white/70 group-hover:text-white" aria-hidden="true">logout</span>
                {isSigningOut ? "กำลังออก…" : "ออกจากระบบ"}
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  // Shadow under the sticky bar once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu on navigation.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
    {/* The menu bar stays at the top while the page scrolls; the title row below scrolls away. */}
    {/* From 1280px the sidebar carries the logo, bell and logout, so the top bar is phone/tablet only. */}
    <header className={`${SIDEBAR ? "xl:hidden " : ""}sticky top-0 z-40 bg-white border-b border-line transition-shadow duration-200 ${scrolled ? "shadow-[var(--shadow-2)]" : ""}`}>
      <div className={`${SIDEBAR ? "" : "max-w-[75rem] mx-auto "}px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4`}>
        {SIDEBAR && (
          <button
            type="button"
            className="icon-button xl:hidden -ml-2"
            aria-label="เปิดเมนู"
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <span className="icon icon--24" aria-hidden="true">menu</span>
          </button>
        )}
        <Link href="/" className={`flex items-center gap-2 text-title-medium text-primary whitespace-nowrap ${SIDEBAR ? "xl:hidden" : ""}`}>
          <span
            className="icon-tile bg-primary text-on-primary"
            aria-hidden="true"
          >
            <span className="icon icon--20 icon--filled">meeting_room</span>
          </span>
          <span className="hidden sm:inline">ระบบจองห้องประชุม</span>
        </Link>

        {!SIDEBAR && (
        <nav ref={navRef} className="relative hidden xl:flex items-center gap-1 flex-1 self-stretch" aria-label="เมนูหลัก">
          {items.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link relative flex items-center gap-2 px-3 h-full text-label-large whitespace-nowrap ${
                  active ? "text-primary" : "text-ink-muted hover:text-primary"
                }`}
              >
                <span className={`icon icon--24 ${active ? "icon--filled" : ""}`} aria-hidden="true">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            );
          })}
          {indicator && (
            <span
              className="nav-indicator"
              style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
              aria-hidden="true"
            />
          )}
        </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <div className={`hidden sm:flex items-center gap-3 ${SIDEBAR ? "xl:hidden" : ""}`} title={user.name}>
              {/* Name and role hide between 1280 and 1536 so the full menu fits (avatar stays). Two tight lines (name / role) centred on the avatar. */}
              <div className={`flex flex-col items-end gap-1 ${SIDEBAR ? "" : "xl:hidden 2xl:flex"}`}>
                <span className="text-label-large leading-none text-ink whitespace-nowrap">{user.name}</span>
                <span className="text-label-medium leading-none text-ink-subtle">{ROLE_LABELS[role || ""] || role}</span>
              </div>
              <span
                className="flex-none inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-container text-on-primary-container"
                aria-hidden="true"
              >
                <span className="icon icon--24">person</span>
              </span>
            </div>
          )}
          {/* One bell at a time: the top bar's below 1280px, the sidebar's from 1280px. */}
          {user?.id && (!SIDEBAR || !isXl) && <NotificationBell userId={user.id} isApprover={isApprover} />}
          {SIDEBAR ? <div className="xl:hidden"><LogoutButton /></div> : <LogoutButton />}
          {!SIDEBAR && (
          <button
            type="button"
            className="icon-button xl:hidden"
            aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={menuOpen}
            aria-controls={SIDEBAR ? "nav-drawer" : "mobile-nav"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span key={menuOpen ? "close" : "menu"} className="icon icon--24 nav-toggle-icon" aria-hidden="true">
              {menuOpen ? "close" : "menu"}
            </span>
          </button>
          )}
        </div>
      </div>

      {!SIDEBAR && menuOpen && (
        <nav id="mobile-nav" className="mobile-nav xl:hidden border-t border-line px-2 py-2 flex flex-col max-h-[calc(100vh-4rem)] overflow-y-auto" aria-label="เมนูหลัก">
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
                className={`flex items-center gap-3 px-4 h-12 rounded-full text-label-large ${
                  active ? "bg-primary-container text-on-primary-container" : "text-ink-muted hover:bg-canvas"
                }`}
              >
                <span className={`icon icon--24 ${active ? "icon--filled" : ""}`} aria-hidden="true">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}

    </header>

      {/* ≥1280px there's no top bar: the bell sits in the top-right corner of the page and scrolls with it. */}
      {SIDEBAR && isXl && user?.id && (
        <div className="absolute top-2 right-6 z-30">
          <NotificationBell userId={user.id} isApprover={isApprover} />
        </div>
      )}

      {SIDEBAR && (
        <>
          {/* Fixed primary-blue menu on the left from 1280px (same pattern as UTCC Store). */}
          <aside className="app-sidebar hidden xl:flex flex-col fixed left-0 top-0 bottom-0 z-30 w-[280px] overflow-hidden bg-primary text-white shadow-xl">
            <SidebarShield />
            <div className="relative px-5 pt-6 pb-5">
              <Link href="/" aria-label="หน้าแรก">
                <img src="/brand/utcc-meetingroom-white.svg" alt="UTCC Meeting Room" width={181} height={64} className="h-16 w-auto" />
              </Link>
            </div>
            <div className="side-scroll relative flex flex-col flex-1 overflow-y-auto">{sideNav(true)}</div>
          </aside>

          {/* Below 1280px the same menu slides in from the left. */}
          {menuOpen && (
            <div className="xl:hidden fixed inset-0 z-50">
              <div className="nav-scrim absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                id="nav-drawer"
                className="nav-drawer absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col overflow-hidden bg-primary text-white shadow-2xl"
              >
                <SidebarShield />
                <div className="relative flex items-center justify-between gap-2 px-5 pt-6 pb-5">
                  <img src="/brand/utcc-meetingroom-white.svg" alt="UTCC Meeting Room" width={181} height={64} className="h-16 w-auto" />
                  <button
                    type="button"
                    className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-white/10"
                    aria-label="ปิดเมนู"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="icon icon--24" aria-hidden="true">close</span>
                  </button>
                </div>
                <div className="side-scroll relative flex flex-col flex-1 overflow-y-auto">{sideNav(false)}</div>
              </div>
            </div>
          )}
        </>
      )}

      {title && (
        <div className="bg-canvas border-b border-line">
          <div className="max-w-[75rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <ol className="flex flex-wrap items-center gap-1 text-body-small text-ink-subtle mb-1" aria-label="breadcrumb">
                <li>
                  <Link href="/" className="hover:text-primary hover:underline">หน้าหลัก</Link>
                </li>
                {breadcrumbs.map((c, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="icon icon--20" aria-hidden="true">chevron_right</span>
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

      <BackToTop />
    </>
  );
}
