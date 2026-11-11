"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ServiceRequestForm from "@/app/components/ServiceRequestForm";
import UserPicker, { type PickedUser } from "@/app/components/UserPicker";
import { useToast } from "@/app/components/Toast";
import { bangkokISO } from "@/lib/format";
import {
  buildServicePayload,
  emptyServiceForm,
  hasErrors,
  LEAD_HINT,
  submitServiceRequest,
  validateServiceForm,
  type ServiceFormErrors,
  type ServiceFormValue,
} from "@/lib/service-form";
import { DEPT_LABEL, deptFromParam, meetsLeadTime, type Dept, type Membership } from "@/lib/service-rules";

const DEPTS: Dept[] = ["AV", "HOUSEKEEPING"];

// useSearchParams needs a Suspense boundary for static rendering.
export default function NewServiceRequestPage() {
  return (
    <Suspense fallback={null}>
      <NewServiceRequestForm />
    </Suspense>
  );
}

function NewServiceRequestForm() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  // ?dept=av|housekeeping preselects the department (used by the queue's "สร้างคำร้อง").
  const [dept, setDept] = useState<Dept>(() => deptFromParam(searchParams.get("dept") ?? "") ?? "AV");
  const [values, setValues] = useState<Record<Dept, ServiceFormValue>>({
    AV: emptyServiceForm(),
    HOUSEKEEPING: emptyServiceForm(),
  });
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [onBehalf, setOnBehalf] = useState<PickedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => me && Array.isArray(me.serviceMemberships) && setMemberships(me.serviceMemberships))
      .catch(() => {});
  }, []);

  const isAdmin = memberships.some((m) => m.department === dept && m.role === "ADMIN");
  const value = values[dept];
  const filing = isAdmin ? onBehalf : null;
  const start = value.date && value.startTime ? new Date(bangkokISO(value.date, value.startTime)) : null;
  // Server skips the lead time only when filing for someone else.
  const leadBlocked = !!start && !filing && !meetsLeadTime(start, new Date());

  const switchDept = (d: Dept) => {
    setDept(d);
    setErrors({});
    setServerError("");
    setOnBehalf(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const errs = validateServiceForm(value, { standalone: true, start, now: new Date(), skipLead: !!filing });
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSubmitting(true);
    const payload = buildServicePayload(dept, value, {
      requesterId: filing?.id,
      startISO: bangkokISO(value.date, value.startTime),
      endISO: bangkokISO(value.date, value.endTime),
    });
    const res = await submitServiceRequest(payload, value.files);
    setSubmitting(false);
    if (res.ok === false) {
      setServerError(res.error);
      return;
    }
    toast(`ส่งคำร้อง${DEPT_LABEL[dept]}แล้ว`, { type: "success" });
    router.push("/my-bookings");
  };

  return (
    <div className="min-h-screen bg-canvas ui-lg">
      <AppHeader title="ขอใช้บริการ" breadcrumbs={[{ label: "การจองของฉัน", href: "/my-bookings" }, { label: "ขอใช้บริการ" }]} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card card--elevated">
          <h2 className="flex items-center gap-2 text-headline-small text-ink mb-5">
            <span className="icon icon--24 text-primary" aria-hidden="true">support_agent</span>
            ขอใช้บริการ
          </h2>

          <div role="tablist" aria-label="แผนก" className="flex gap-2 mb-6">
            {DEPTS.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={dept === d}
                onClick={() => switchDept(d)}
                className={dept === d ? "btn-primary" : "btn-secondary"}
              >
                {DEPT_LABEL[d]}
              </button>
            ))}
          </div>

          {serverError && (
            <div className="alert alert--error mb-4" role="alert">
              <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
              {serverError}
            </div>
          )}

          <form onSubmit={submit} noValidate className="space-y-6">
            {isAdmin && (
              <div>
                <label htmlFor="svc-for" className="field-label">ยื่นแทน</label>
                <UserPicker inputId="svc-for" value={onBehalf} onChange={setOnBehalf} selfId={(session?.user as any)?.id} />
              </div>
            )}

            <ServiceRequestForm
              key={dept}
              department={dept}
              mode="standalone"
              value={value}
              onChange={(next) => setValues((prev) => ({ ...prev, [dept]: next }))}
              errors={errors}
            />

            {leadBlocked && (
              <p className="field-error flex items-center gap-1" role="alert">
                <span className="icon icon--20" aria-hidden="true">error</span>
                {LEAD_HINT}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || leadBlocked}
              className="w-full btn-primary h-[52px] px-[34px] text-title-medium"
            >
              <span className="icon icon--24" aria-hidden="true">send</span>
              {submitting ? "กำลังส่ง..." : "ส่งคำร้อง"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
