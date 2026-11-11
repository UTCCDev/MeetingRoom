"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import DatePicker from "@/app/components/DatePicker";
import Dropdown from "@/app/components/Dropdown";
import Pagination, { usePagination } from "@/app/components/Pagination";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { bangkokISO, formatRange, toDateKey, todayKey } from "@/lib/format";
import {
  BADGE,
  countByStatus,
  filterRows,
  itemsText,
  needsReturn,
  postJson,
  STATUS_ORDER,
  type ServiceRow,
} from "@/lib/service-client";
import { DEPT_LABEL, deptParam, SERVICE_STATUS_LABEL, type Dept, type SStatus } from "@/lib/service-rules";

type DialogKind = "accept" | "reject" | "edit" | "progress" | "done";
interface Dialog {
  kind: DialogKind;
  row: ServiceRow;
}
interface Member {
  id: string;
  userId: string;
  role: "ADMIN" | "STAFF";
  user: { id: string; name: string; email: string };
}

const PAGE_SIZE = 10;
const dayOf = (iso: string | null) => (iso ? toDateKey(iso) : "");

/**
 * Queue of one department's requests. "admin" = the department admin's full queue
 * (accept / reject / edit / progress / done); "staff" = only what is assigned to me
 * (progress / done). The API decides what each role may see and do.
 */
export default function ServiceQueue({ dept, mode }: { dept: Dept; mode: "admin" | "staff" }) {
  const toast = useToast();
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id as string | undefined;
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<SStatus>(mode === "admin" ? "PENDING" : "ACCEPTED");
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ServiceRow | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/service-requests?scope=queue&dept=${dept}`).catch(() => null);
    if (!res?.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setError(data.error || "ไม่สามารถโหลดรายการคำร้องได้");
      return setRows([]);
    }
    setError("");
    setRows(await res.json().catch(() => []));
  }, [dept]);

  useEffect(() => {
    load();
  }, [load]);

  // Drawer: fetch the full request (attachments) once opened.
  useEffect(() => {
    setDetail(null);
    if (!openId) return;
    let alive = true;
    fetch(`/api/service-requests/${openId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setDetail(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [openId, rows]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !dialog && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, dialog]);

  const all = rows ?? [];
  const counts = useMemo(() => countByStatus(all), [all]);
  const visible = useMemo(() => filterRows(all, { status: tab, q, date }), [all, tab, q, date]);
  const paged = usePagination(visible, PAGE_SIZE, `${tab}|${q}|${date}`);
  const open = openId ? all.find((r) => r.id === openId) ?? null : null;
  const openRow = open ? { ...open, ...(detail && detail.id === open.id ? detail : {}) } : null;

  const afterAction = async (message: string) => {
    toast(message, { type: "success" });
    setDialog(null);
    await load();
  };

  const actionButtons = (r: ServiceRow) => {
    const btn = (kind: DialogKind, label: string, icon: string, cls = "btn-secondary") => (
      <button key={kind} type="button" className={`${cls} btn--s`} onClick={() => setDialog({ kind, row: r })}>
        <span className="icon icon--20" aria-hidden="true">{icon}</span>
        {label}
      </button>
    );
    const out = [];
    if (mode === "admin") {
      if (r.status === "PENDING") out.push(btn("accept", "รับงาน", "check", "btn-primary"), btn("reject", "ปฏิเสธ", "close"));
      if (r.status === "ACCEPTED" || r.status === "IN_PROGRESS" || r.status === "DONE") out.push(btn("edit", "แก้ไข", "edit"));
    }
    if (r.status === "ACCEPTED") out.push(btn("progress", "เริ่มดำเนินการ", "play_arrow", "btn-primary"));
    if (r.status === "IN_PROGRESS") out.push(btn("done", "เสร็จสิ้น", "task_alt", "btn-primary"));
    return out;
  };

  return (
    <>
      {error && (
        <div className="alert alert--error mb-4" role="alert">
          <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div role="tablist" aria-label="สถานะคำร้อง" className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={`${tab === s ? "btn-primary" : "btn-secondary"} btn--s`}
            >
              {SERVICE_STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
        {mode === "admin" && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/services/${deptParam(dept)}/catalog`} className="btn-secondary">
              <span className="icon icon--20" aria-hidden="true">inventory_2</span>
              จัดการรายการอุปกรณ์
            </Link>
            <Link href={`/services/new?dept=${deptParam(dept)}`} className="btn-primary">
              <span className="icon icon--20" aria-hidden="true">add</span>
              สร้างคำร้อง
            </Link>
          </div>
        )}
      </div>

      <div className="card mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="svc-q" className="field-label">ค้นหา</label>
          <input
            id="svc-q"
            className="input-field"
            value={q}
            placeholder="ชื่อผู้ขอ หรือห้อง/สถานที่"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="min-w-[220px]">
          <label htmlFor="svc-date" className="field-label">วันที่ใช้บริการ</label>
          <DatePicker id="svc-date" value={date} onChange={setDate} placeholder="ทุกวัน" clearable />
        </div>
      </div>

      <div ref={paged.listRef}>
        {rows === null ? (
          <SkeletonCards count={3} />
        ) : visible.length === 0 ? (
          <div className="card empty-state">
            <p>{all.length === 0 ? "ยังไม่มีคำร้อง" : "ไม่พบคำร้องตามเงื่อนไขที่เลือก"}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {paged.pageItems.map((r) => (
              <li key={r.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="card__title break-words">{itemsText(r.items) || "-"}</h3>
                    <p className="text-body-medium text-ink-muted mt-1 tabular-nums">{formatRange(r.startTime, r.endTime)}</p>
                    <p className="text-body-medium text-ink-muted break-words">
                      {r.booking ? `${r.booking.room.name} · ${r.booking.title}` : r.location}
                    </p>
                    <p className="text-body-small text-ink-subtle mt-1">
                      ผู้ขอ: {r.requester.name}
                      {r.assignee && <> · ผู้รับผิดชอบ: {r.assignee.name}</>}
                    </p>
                  </div>
                  <span className={BADGE[r.status]}>{SERVICE_STATUS_LABEL[r.status]}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button type="button" className="btn-text btn--s" onClick={() => setOpenId(r.id)}>
                    <span className="icon icon--20" aria-hidden="true">visibility</span>
                    ดูรายละเอียด
                  </button>
                  {actionButtons(r)}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          page={paged.page}
          pageCount={paged.pageCount}
          onChange={paged.setPage}
          from={paged.from}
          to={paged.to}
          total={visible.length}
        />
      </div>

      {openRow && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/50" onClick={() => setOpenId(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="svc-drawer-title"
            className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 id="svc-drawer-title" className="text-title-large text-ink">
                คำร้อง{DEPT_LABEL[openRow.department]}
              </h2>
              <button type="button" className="icon-button" aria-label="ปิด" onClick={() => setOpenId(null)}>
                <span className="icon icon--24" aria-hidden="true">close</span>
              </button>
            </div>
            <span className={BADGE[openRow.status]}>{SERVICE_STATUS_LABEL[openRow.status]}</span>

            <dl className="mt-4 space-y-3 text-body-medium">
              <Field label="รายการ">
                <ul className="list-disc pl-5">
                  {openRow.items.map((i) => (
                    <li key={i.id}>
                      {i.catalogItem?.name ?? i.otherText} × {i.qty}
                    </li>
                  ))}
                </ul>
              </Field>
              <Field label="วันเวลา">{formatRange(openRow.startTime, openRow.endTime)}</Field>
              {openRow.booking ? (
                <Field label="การจอง">
                  {openRow.requesterId === myId ? (
                    <Link href={`/my-bookings/${openRow.booking.id}`} className="text-primary hover:underline">
                      {openRow.booking.title} · {openRow.booking.room.name}
                    </Link>
                  ) : (
                    <>{openRow.booking.title} · {openRow.booking.room.name}</>
                  )}
                </Field>
              ) : (
                <Field label="สถานที่">{openRow.location}</Field>
              )}
              <Field label="ผู้ขอ">
                {openRow.requester.name} ({openRow.requester.email})
              </Field>
              <Field label="เบอร์ติดต่อ">{openRow.contactPhone}</Field>
              {openRow.note && <Field label="หมายเหตุ">{openRow.note}</Field>}
              {openRow.assignee && <Field label="ผู้รับผิดชอบ">{openRow.assignee.name}</Field>}
              {openRow.coordinatorName && (
                <Field label="ผู้ประสานงาน">
                  {openRow.coordinatorName} {openRow.coordinatorPhone}
                </Field>
              )}
              {openRow.internalNote && <Field label="บันทึกภายใน">{openRow.internalNote}</Field>}
              {openRow.rejectionReason && <Field label="เหตุผลที่ปฏิเสธ">{openRow.rejectionReason}</Field>}
              {openRow.borrowedAt && <Field label="วันที่ยืม">{dayOf(openRow.borrowedAt)}</Field>}
              {openRow.returnedAt && <Field label="วันที่คืน">{dayOf(openRow.returnedAt)}</Field>}
              {openRow.attachments && openRow.attachments.length > 0 && (
                <Field label="ไฟล์แนบ">
                  <ul className="space-y-1">
                    {openRow.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                          {a.originalName || a.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </dl>

            <div className="flex flex-wrap gap-2 mt-6">{actionButtons(openRow)}</div>
          </aside>
        </div>
      )}

      {dialog && (
        <ActionDialog
          dialog={dialog}
          dept={dept}
          onClose={() => setDialog(null)}
          onDone={afterAction}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label-large text-ink-subtle">{label}</dt>
      <dd className="text-ink break-words">{children}</dd>
    </div>
  );
}

/** One confirm dialog per action; each one posts to its own endpoint. */
function ActionDialog({
  dialog,
  dept,
  onClose,
  onDone,
}: {
  dialog: Dialog;
  dept: Dept;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { kind, row } = dialog;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [assigneeId, setAssigneeId] = useState(row.assigneeId ?? "");
  const [coordName, setCoordName] = useState(row.coordinatorName ?? "");
  const [coordPhone, setCoordPhone] = useState(row.coordinatorPhone ?? "");
  const [internalNote, setInternalNote] = useState(row.internalNote ?? "");
  const [reason, setReason] = useState("");
  const returnable = needsReturn(row.items);
  const [borrowedAt, setBorrowedAt] = useState(dayOf(row.borrowedAt) || (kind === "progress" ? todayKey() : ""));
  const [returnedAt, setReturnedAt] = useState(dayOf(row.returnedAt) || (kind === "done" ? todayKey() : ""));

  useEffect(() => {
    if (kind !== "accept" && kind !== "edit") return;
    fetch(`/api/service-members?dept=${dept}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => {});
  }, [kind, dept]);

  const run = async (url: string, body: unknown, message: string) => {
    setBusy(true);
    setErr("");
    try {
      await postJson(`/api/service-requests/${row.id}/${url}`, body);
      await onDone(message);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dayStart = (d: string) => bangkokISO(d, "00:00");
  const onConfirm = () => {
    if (kind === "accept") {
      if (!assigneeId) return setErr("กรุณาเลือกผู้รับผิดชอบ");
      return run("accept", { assigneeId, coordinatorName: coordName, coordinatorPhone: coordPhone, internalNote }, "รับงานแล้ว");
    }
    if (kind === "reject") {
      if (!reason.trim()) return setErr("กรุณาระบุเหตุผล");
      return run("reject", { reason: reason.trim() }, "ปฏิเสธคำร้องแล้ว");
    }
    if (kind === "progress") {
      return run("progress", returnable && borrowedAt ? { borrowedAt: dayStart(borrowedAt) } : {}, "เริ่มดำเนินการแล้ว");
    }
    if (kind === "done") {
      if (returnable && !returnedAt) return setErr("กรุณาระบุวันที่คืนอุปกรณ์");
      return run("done", returnable && returnedAt ? { returnedAt: dayStart(returnedAt) } : {}, "ปิดงานแล้ว");
    }
    // edit: dates are sent only when the admin changed them, so a saved time is not overwritten.
    const body: Record<string, unknown> = { coordinatorName: coordName, coordinatorPhone: coordPhone, internalNote };
    if (assigneeId) body.assigneeId = assigneeId;
    if (borrowedAt !== dayOf(row.borrowedAt)) body.borrowedAt = borrowedAt ? dayStart(borrowedAt) : null;
    if (returnedAt !== dayOf(row.returnedAt)) body.returnedAt = returnedAt ? dayStart(returnedAt) : null;
    return run("update", body, "บันทึกการแก้ไขแล้ว");
  };

  const TITLE: Record<DialogKind, string> = {
    accept: `รับงาน${DEPT_LABEL[dept]}`,
    reject: "ปฏิเสธคำร้อง",
    edit: "แก้ไขคำร้อง",
    progress: "เริ่มดำเนินการ",
    done: "เสร็จสิ้นงาน",
  };
  const CONFIRM: Record<DialogKind, string> = {
    accept: "รับงาน",
    reject: "ปฏิเสธ",
    edit: "บันทึก",
    progress: "เริ่มดำเนินการ",
    done: "เสร็จสิ้น",
  };

  const memberOptions = members.map((m) => ({ value: m.userId, label: m.user.name, hint: m.user.email }));
  const assigneeField = (
    <div>
      <label htmlFor="svc-assignee" className="field-label">ผู้รับผิดชอบ</label>
      <Dropdown
        id="svc-assignee"
        options={memberOptions}
        value={assigneeId}
        onChange={setAssigneeId}
        placeholder="เลือกผู้รับผิดชอบ"
        selectedLabel={row.assignee?.name}
      />
    </div>
  );
  const coordFields = (
    <>
      <div>
        <label htmlFor="svc-coord-name" className="field-label">ชื่อผู้ประสานงาน (ถ้ามี)</label>
        <input id="svc-coord-name" className="input-field" maxLength={100} value={coordName} onChange={(e) => setCoordName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="svc-coord-phone" className="field-label">เบอร์ผู้ประสานงาน (ถ้ามี)</label>
        <input id="svc-coord-phone" className="input-field" maxLength={30} value={coordPhone} onChange={(e) => setCoordPhone(e.target.value)} />
      </div>
      <div>
        <label htmlFor="svc-note" className="field-label">บันทึกภายใน (ถ้ามี)</label>
        <textarea id="svc-note" className="input-field" rows={3} maxLength={1000} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
      </div>
    </>
  );

  return (
    <ConfirmDialog
      open
      title={TITLE[kind]}
      tone={kind === "reject" ? "danger" : "primary"}
      confirmLabel={CONFIRM[kind]}
      cancelLabel="ยกเลิก"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onClose}
    >
      <div className="space-y-4 text-left">
        {kind === "accept" && (
          <>
            {assigneeField}
            {coordFields}
          </>
        )}
        {kind === "edit" && (
          <>
            {assigneeField}
            {coordFields}
            <div>
              <label htmlFor="svc-borrowed" className="field-label">วันที่ยืม</label>
              <DatePicker id="svc-borrowed" value={borrowedAt} onChange={setBorrowedAt} placeholder="ไม่ระบุ" clearable />
            </div>
            <div>
              <label htmlFor="svc-returned" className="field-label">วันที่คืน</label>
              <DatePicker id="svc-returned" value={returnedAt} onChange={setReturnedAt} placeholder="ไม่ระบุ" clearable />
            </div>
          </>
        )}
        {kind === "reject" && (
          <div>
            <label htmlFor="svc-reason" className="field-label">เหตุผลที่ปฏิเสธ</label>
            <textarea id="svc-reason" className="input-field" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {kind === "progress" && (
          <>
            <p>เริ่มดำเนินการตามคำร้องนี้</p>
            {returnable && (
              <div>
                <label htmlFor="svc-borrowed" className="field-label">วันที่ยืมอุปกรณ์</label>
                <DatePicker id="svc-borrowed" value={borrowedAt} onChange={setBorrowedAt} placeholder="เลือกวันที่" clearable />
              </div>
            )}
          </>
        )}
        {kind === "done" && (
          <>
            <p>ปิดงานคำร้องนี้</p>
            {returnable && (
              <div>
                <label htmlFor="svc-returned" className="field-label">วันที่คืนอุปกรณ์</label>
                <DatePicker id="svc-returned" value={returnedAt} onChange={setReturnedAt} placeholder="เลือกวันที่" />
              </div>
            )}
          </>
        )}
        {err && (
          <p className="field-error flex items-center gap-1" role="alert">
            <span className="icon icon--20" aria-hidden="true">error</span>
            {err}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
