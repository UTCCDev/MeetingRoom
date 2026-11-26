"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import DatePicker from "@/app/components/DatePicker";
import { SkeletonCards } from "@/app/components/Skeleton";
import { addDays, roomLocation, roomTitle, todayKey } from "@/lib/format";

interface Row {
  roomId: string;
  roomCode: string | null;
  roomName: string;
  roomDescription: string | null;
  departmentId: string | null;
  departmentName: string;
  bookings: number;
  minutes: number;
  attendees: number;
}

type View = "room" | "department";

interface Group {
  key: string;
  title: string;
  subtitle?: string;
  bookings: number;
  minutes: number;
  items: { key: string; label: string; hint?: string; bookings: number; minutes: number; attendees: number }[];
}

const hoursText = (minutes: number) =>
  (minutes / 60).toLocaleString("th-TH", { maximumFractionDigits: 1 });

const roomText = (r: Row) => roomTitle({ name: r.roomName, code: r.roomCode });

// Spreadsheet apps run cells starting with these characters as formulas.
const csvCell = (v: string | number) => {
  const s = String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

function buildGroups(rows: Row[], view: View): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const byRoom = view === "room";
    const key = byRoom ? r.roomId : r.departmentId ?? "";
    const group = map.get(key) ?? {
      key,
      title: byRoom ? roomText(r) : r.departmentName,
      subtitle: byRoom ? roomLocation(r.roomDescription) : undefined,
      bookings: 0,
      minutes: 0,
      items: [],
    };
    group.bookings += r.bookings;
    group.minutes += r.minutes;
    group.items.push({
      key: byRoom ? r.departmentId ?? "" : r.roomId,
      label: byRoom ? r.departmentName : roomText(r),
      hint: byRoom ? undefined : roomLocation(r.roomDescription),
      bookings: r.bookings,
      minutes: r.minutes,
      attendees: r.attendees,
    });
    map.set(key, group);
  }
  const groups = [...map.values()];
  groups.forEach((g) => g.items.sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label, "th")));
  return groups.sort((a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title, "th"));
}

export default function UsageReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const role = (session?.user as any)?.role as string | undefined;

  const [rows, setRows] = useState<Row[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => addDays(todayKey(), -30));
  const [to, setTo] = useState(() => todayKey());
  const [view, setView] = useState<View>("room");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated" && role === "USER") {
      router.push("/");
    }
  }, [status, role, router, pathname]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/admin/reports?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "โหลดรายงานไม่สำเร็จ");
      setRows(data.rows);
      setTruncated(!!data.truncated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (status === "authenticated" && role !== "USER") load();
  }, [status, role, load]);

  const groups = useMemo(() => buildGroups(rows, view), [rows, view]);
  const totals = useMemo(
    () => ({
      bookings: rows.reduce((n, r) => n + r.bookings, 0),
      minutes: rows.reduce((n, r) => n + r.minutes, 0),
      rooms: new Set(rows.map((r) => r.roomId)).size,
      departments: new Set(rows.map((r) => r.departmentId ?? "")).size,
    }),
    [rows]
  );

  const exportCsv = () => {
    const head = ["ห้อง", "สถานที่", "หน่วยงาน", "จำนวนครั้ง", "ชั่วโมงรวม", "ผู้เข้าร่วมรวม"];
    const lines = [...rows]
      .sort((a, b) => roomText(a).localeCompare(roomText(b), "th") || b.minutes - a.minutes)
      .map((r) =>
        [roomText(r), roomLocation(r.roomDescription), r.departmentName, r.bookings, (r.minutes / 60).toFixed(2), r.attendees]
          .map(csvCell)
          .join(",")
      );
    const csv = "\uFEFF" + [head.map(csvCell).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `room-usage-${from || "start"}_${to || "end"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = [
    { icon: "event_available", label: "การจองที่อนุมัติ", value: totals.bookings.toLocaleString("th-TH") },
    { icon: "schedule", label: "ชั่วโมงใช้งานรวม", value: hoursText(totals.minutes) },
    { icon: "meeting_room", label: "ห้องที่ถูกใช้", value: totals.rooms.toLocaleString("th-TH") },
    { icon: "apartment", label: "หน่วยงานที่ใช้", value: totals.departments.toLocaleString("th-TH") },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="รายงานการใช้ห้อง" breadcrumbs={[{ label: "รายงานการใช้ห้อง" }]} />

      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-body-medium text-ink-muted mb-6">
          {role === "SYSTEM_ADMIN" ? "ทุกห้องในระบบ" : "ห้องที่คุณดูแลหรือเป็นผู้อนุมัติ"} นับเฉพาะการจองที่อนุมัติแล้ว
          ตามวันที่เริ่มประชุม และนับเป็นของหน่วยงานที่ระบุในการจอง (ถ้าไม่ระบุ ใช้หน่วยงานของผู้จอง)
        </p>

        <div className="card mb-6 flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-44">
            <label htmlFor="report-from" className="field-label">ตั้งแต่วันที่</label>
            <DatePicker id="report-from" value={from} onChange={setFrom} placeholder="30 วันที่ผ่านมา" clearable />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="report-to" className="field-label">ถึงวันที่</label>
            <DatePicker id="report-to" value={to} onChange={setTo} min={from || undefined} placeholder="วันนี้" clearable />
          </div>
          <button type="button" className="btn-secondary sm:ml-auto" onClick={exportCsv} disabled={isLoading || rows.length === 0}>
            <span className="icon icon--20" aria-hidden="true">download</span>
            ดาวน์โหลด CSV
          </button>
        </div>

        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}
        {truncated && (
          <div className="alert mb-4" role="status">
            <span className="icon icon--24" aria-hidden="true">info</span>
            ข้อมูลมากเกินไป แสดงเพียงบางส่วน กรุณาเลือกช่วงวันที่ให้แคบลง
          </div>
        )}

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summary.map((s) => (
            <div key={s.label} className="card flex items-center gap-3">
              <span className="icon-tile bg-primary-container text-on-primary-container" aria-hidden="true">
                <span className="icon icon--24">{s.icon}</span>
              </span>
              <div className="min-w-0">
                <dd className="text-headline-small text-ink tabular-nums">{isLoading ? "–" : s.value}</dd>
                <dt className="text-body-small text-ink-subtle">{s.label}</dt>
              </div>
            </div>
          ))}
        </dl>

        <div className="chip-group mb-6" role="group" aria-label="มุมมองรายงาน">
          {[
            { value: "room" as const, icon: "meeting_room", label: "รายห้อง: หน่วยงานที่ใช้ห้อง" },
            { value: "department" as const, icon: "apartment", label: "รายหน่วยงาน: ห้องที่หน่วยงานใช้" },
          ].map((v) => (
            <button key={v.value} type="button" className="chip" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
              <span className="icon icon--20" aria-hidden="true">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <SkeletonCards count={3} className="space-y-4" />
        ) : groups.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 text-ink-subtle" aria-hidden="true">insert_chart</span>
            <p>ไม่มีการใช้ห้องในช่วงวันที่ที่เลือก</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.key} className="card p-0 sm:p-0 overflow-hidden">
                <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-line">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-title-large text-ink">
                      <span className="icon icon--24 text-primary" aria-hidden="true">
                        {view === "room" ? "meeting_room" : "apartment"}
                      </span>
                      {g.title}
                    </h2>
                    {g.subtitle && <p className="text-body-small text-ink-subtle mt-1">{g.subtitle}</p>}
                  </div>
                  <p className="text-body-medium text-ink-muted tabular-nums">
                    <span className="text-ink font-medium">{g.bookings.toLocaleString("th-TH")}</span> ครั้ง ·{" "}
                    <span className="text-ink font-medium">{hoursText(g.minutes)}</span> ชม.
                  </p>
                </header>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{view === "room" ? "หน่วยงาน" : "ห้อง"}</th>
                        <th className="text-right">ครั้ง</th>
                        <th className="text-right">ชั่วโมง</th>
                        <th className="text-right">ผู้เข้าร่วมรวม</th>
                        <th className="w-48">สัดส่วนเวลา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((it) => {
                        const pct = g.minutes ? Math.round((it.minutes / g.minutes) * 100) : 0;
                        return (
                          <tr key={it.key}>
                            <td className="text-ink">
                              {it.label}
                              {it.hint && <span className="block text-body-small text-ink-subtle">{it.hint}</span>}
                            </td>
                            <td className="text-right tabular-nums">{it.bookings.toLocaleString("th-TH")}</td>
                            <td className="text-right tabular-nums">{hoursText(it.minutes)}</td>
                            <td className="text-right tabular-nums">{it.attendees.toLocaleString("th-TH")}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="flex-1 h-2 rounded-full bg-canvas overflow-hidden" aria-hidden="true">
                                  <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                                </span>
                                <span className="w-10 text-right tabular-nums text-body-small">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
