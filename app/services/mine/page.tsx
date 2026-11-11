"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import Pagination, { usePagination } from "@/app/components/Pagination";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { formatRange } from "@/lib/format";
import { BADGE, itemsText, postJson, type ServiceRow } from "@/lib/service-client";
import { canRequesterCancel, DEPT_LABEL, SERVICE_STATUS_LABEL } from "@/lib/service-rules";

export default function MyServiceRequestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { status } = useSession();
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<ServiceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const paged = usePagination(rows ?? [], 10);

  const load = useCallback(async () => {
    const res = await fetch("/api/service-requests?scope=mine").catch(() => null);
    if (!res?.ok) {
      setError("ไม่สามารถโหลดรายการคำร้องได้");
      return setRows([]);
    }
    setError("");
    const all: ServiceRow[] = await res.json().catch(() => []);
    // Newest use date first.
    setRows(all.sort((a, b) => b.startTime.localeCompare(a.startTime)));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    else if (status === "authenticated") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await postJson(`/api/service-requests/${cancelling.id}/cancel`);
      toast(`ยกเลิกคำร้อง${DEPT_LABEL[cancelling.department]}แล้ว`, { type: "success" });
    } catch (e) {
      toast((e as Error).message || "ยกเลิกคำร้องไม่สำเร็จ", { type: "error" });
    }
    setBusy(false);
    setCancelling(null);
    load();
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        title="คำร้องบริการของฉัน"
        breadcrumbs={[{ label: "คำร้องบริการของฉัน" }]}
        actions={
          <Link href="/services/new" className="btn-primary">
            <span className="icon icon--20" aria-hidden="true">add</span>
            ขอใช้บริการ
          </Link>
        }
      />
      <main className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}
        <div ref={paged.listRef}>
          {rows === null ? (
            <SkeletonCards count={3} />
          ) : rows.length === 0 ? (
            <div className="card empty-state">
              <p>ยังไม่มีคำร้องบริการ</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {paged.pageItems.map((r) => (
                <li key={r.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="card__title">{DEPT_LABEL[r.department]}</h3>
                      <p className="text-body-medium text-ink-muted mt-1 break-words">{itemsText(r.items)}</p>
                      <p className="text-body-medium text-ink-muted tabular-nums">{formatRange(r.startTime, r.endTime)}</p>
                      <p className="text-body-small text-ink-subtle break-words">
                        {r.booking ? `${r.booking.room.name} · ${r.booking.title}` : r.location}
                      </p>
                      {r.status === "REJECTED" && r.rejectionReason && (
                        <p className="text-body-small text-ink-muted mt-1">เหตุผล: {r.rejectionReason}</p>
                      )}
                    </div>
                    <span className={r.waitingRoom ? "badge-pending" : BADGE[r.status]}>
                      {r.waitingRoom ? "รอห้องอนุมัติ" : SERVICE_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {canRequesterCancel({ status: r.status, startTime: new Date(r.startTime) }, new Date()) && (
                    <div className="mt-4">
                      <button type="button" className="btn-text" onClick={() => setCancelling(r)}>
                        <span className="icon icon--20" aria-hidden="true">cancel</span>
                        ยกเลิกคำร้อง
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} from={paged.from} to={paged.to} total={rows?.length ?? 0} />
        </div>
      </main>

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
