"use client";

import { use, type ReactNode } from "react";
import AppHeader from "@/app/components/AppHeader";
import { useMemberships } from "@/app/components/useMemberships";
import { SkeletonCards } from "@/app/components/Skeleton";
import { DEPT_LABEL, deptFromParam, membershipIn, type Dept } from "@/lib/service-rules";

/**
 * Shell for /services/[dept]/... pages. Shows a 404-style message when the segment is not a
 * department or the user lacks the needed membership (ADMIN, or any member). The APIs enforce
 * the same rules; this only keeps the UI honest.
 */
export default function DeptPage({
  params,
  need,
  title,
  suffix,
  children,
}: {
  params: Promise<{ dept: string }>;
  need: "ADMIN" | "MEMBER";
  title: (label: string) => string;
  /** Breadcrumb for sub-pages, e.g. "รายการอุปกรณ์". */
  suffix?: string;
  children: (dept: Dept) => ReactNode;
}) {
  const { dept: param } = use(params);
  const dept = deptFromParam(param);
  const memberships = useMemberships(!!dept);
  const m = dept && memberships ? membershipIn(memberships, dept) : null;
  const allowed = !!m && (need === "MEMBER" || m.role === "ADMIN");

  if (!dept || (memberships && !allowed)) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader title="ไม่พบหน้านี้" />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="card empty-state" role="alert">
            <p>ไม่พบหน้านี้</p>
          </div>
        </main>
      </div>
    );
  }

  const label = DEPT_LABEL[dept];
  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title={title(label)} breadcrumbs={suffix ? [{ label: `งาน${label}` }, { label: suffix }] : [{ label: `งาน${label}` }]} />
      <main className="max-w-5xl mx-auto px-4 py-6">{memberships ? children(dept) : <SkeletonCards count={3} />}</main>
    </div>
  );
}
