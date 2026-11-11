"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import ServiceRequestForm from "@/app/components/ServiceRequestForm";
import { useToast } from "@/app/components/Toast";
import {
  buildServicePayload,
  emptyServiceForm,
  hasErrors,
  submitServiceRequest,
  validateServiceForm,
  type ServiceFormErrors,
  type ServiceFormValue,
} from "@/lib/service-form";
import {
  canRequesterCancel,
  DEPT_LABEL,
  SERVICE_STATUS_LABEL,
  type Dept,
  type SStatus,
} from "@/lib/service-rules";

interface ServiceRow {
  id: string;
  department: Dept;
  status: SStatus;
  bookingId: string | null;
  requesterId: string;
  startTime: string;
  waitingRoom: boolean;
  items: { id: string; qty: number; otherText: string | null; catalogItem: { name: string } | null }[];
}

const DEPTS: Dept[] = ["AV", "HOUSEKEEPING"];

const BADGE: Record<SStatus, string> = {
  PENDING: "badge-pending",
  ACCEPTED: "badge-primary",
  IN_PROGRESS: "badge-primary",
  DONE: "badge-available",
  REJECTED: "badge-neutral",
  CANCELLED: "badge-neutral",
};

/** Service requests attached to one booking, with cancel and "request more". */
export default function BookingServices({
  bookingId,
  bookingStart,
  canRequest,
}: {
  bookingId: string;
  bookingStart: string;
  /** Booking is still PENDING/APPROVED and has not ended. */
  canRequest: boolean;
}) {
  const toast = useToast();
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id as string | undefined;
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [adding, setAdding] = useState<Dept | null>(null);
  const [value, setValue] = useState<ServiceFormValue>(emptyServiceForm());
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<ServiceRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/service-requests?scope=booking&bookingId=${encodeURIComponent(bookingId)}`).catch(() => null);
    if (!res?.ok) return setRows([]);
    const all: ServiceRow[] = await res.json().catch(() => []);
    setRows(all);
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (rows === null) return null;
  const requested = new Set(rows.filter((r) => r.status !== "CANCELLED").map((r) => r.department));
  const available = canRequest ? DEPTS.filter((d) => !requested.has(d)) : [];
  if (rows.length === 0 && available.length === 0) return null;

  const open = (d: Dept) => {
    setAdding(d);
    setValue(emptyServiceForm());
    setErrors({});
    setServerError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adding) return;
    setServerError("");
    const errs = validateServiceForm(value, { standalone: false, start: new Date(bookingStart), now: new Date() });
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSubmitting(true);
    const res = await submitServiceRequest(buildServicePayload(adding, value, { bookingId }), value.files);
    setSubmitting(false);
    if (res.ok === false) return setServerError(res.error);
    toast(`ส่งคำร้อง${DEPT_LABEL[adding]}แล้ว`, { type: "success" });
    setAdding(null);
    load();
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    const res = await fetch(`/api/service-requests/${cancelling.id}/cancel`, { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      toast(data.error || "ยกเลิกคำร้องไม่สำเร็จ", { type: "error" });
    } else {
      toast(`ยกเลิกคำร้อง${DEPT_LABEL[cancelling.department]}แล้ว`, { type: "success" });
    }
    setCancelling(null);
    load();
  };

  return (
    <div className="card mt-4">
      <h3 className="flex items-center gap-2 text-title-large text-ink mb-3">
        <span className="icon icon--24 text-primary" aria-hidden="true">support_agent</span>
        บริการเพิ่มเติม
      </h3>

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="p-3 rounded-sm border border-line bg-canvas">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-title-small text-ink flex-1 min-w-0">{DEPT_LABEL[r.department]}</span>
                <span className={r.waitingRoom ? "badge-pending" : BADGE[r.status]}>
                  {r.waitingRoom ? "รอห้องอนุมัติ" : SERVICE_STATUS_LABEL[r.status]}
                </span>
                {r.requesterId === myId && canRequesterCancel({ status: r.status, startTime: new Date(r.startTime) }, new Date()) && (
                  <button type="button" className="btn-text" onClick={() => setCancelling(r)}>
                    <span className="icon icon--20" aria-hidden="true">cancel</span>
                    ยกเลิกคำร้อง
                  </button>
                )}
              </div>
              <p className="text-body-medium text-ink-muted mt-1 break-words">
                {r.items
                  .map((i) => `${i.catalogItem?.name ?? i.otherText ?? ""} × ${i.qty}`)
                  .join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && !adding && (
        <div className="flex flex-wrap gap-3 mt-4">
          {available.map((d) => (
            <button key={d} type="button" className="btn-secondary" onClick={() => open(d)}>
              <span className="icon icon--20" aria-hidden="true">add</span>
              ขอบริการเพิ่ม: {DEPT_LABEL[d]}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={submit} noValidate className="mt-4 space-y-6 border-t border-line pt-4">
          <h4 className="text-title-medium text-ink">ขอบริการ{DEPT_LABEL[adding]}</h4>
          {serverError && (
            <div className="alert alert--error" role="alert">
              <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
              {serverError}
            </div>
          )}
          <ServiceRequestForm department={adding} mode="embedded" value={value} onChange={setValue} errors={errors} />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" className="btn-text" onClick={() => setAdding(null)} disabled={submitting}>
              ยกเลิก
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <span className="icon icon--20" aria-hidden="true">send</span>
              {submitting ? "กำลังส่ง..." : "ส่งคำร้อง"}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={!!cancelling}
        title={cancelling ? `ยกเลิกคำร้อง${DEPT_LABEL[cancelling.department]}?` : ""}
        tone="danger"
        confirmLabel="ยกเลิกคำร้อง"
        cancelLabel="ไม่ยกเลิก"
        busy={busy}
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
      >
        คำร้องนี้จะถูกยกเลิก
      </ConfirmDialog>
    </div>
  );
}
